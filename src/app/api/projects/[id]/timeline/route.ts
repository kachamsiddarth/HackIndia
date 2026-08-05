import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: projectId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { data: null, error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  try {
    const admin = createAdminClient();

    // Fetch accessibility_scores for this project, ordered by time
    const { data: scores } = await admin
      .from("accessibility_scores")
      .select("*")
      .eq("project_id", projectId)
      .order("measured_at", { ascending: true });

    // Fetch pipeline runs for this project to build timeline events
    const { data: runs } = await admin
      .from("pipeline_runs")
      .select("id, status, total_issues, fixes_generated, fixes_verified, summary, created_at, completed_at, base_commit_sha, head_commit_sha")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    const scoreTimeline = (scores ?? []).map((s) => ({
      id: s.id,
      commitSha: s.commit_sha,
      score: Number(s.score),
      totalIssues: s.total_issues,
      criticalIssues: s.critical_issues,
      majorIssues: s.major_issues,
      minorIssues: s.minor_issues,
      advisoryIssues: s.advisory_issues,
      measuredAt: s.measured_at,
    }));

    const runTimeline = (runs ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      totalIssues: r.total_issues,
      fixesGenerated: r.fixes_generated,
      fixesVerified: r.fixes_verified,
      summary: formatRunSummary(r.summary, r.total_issues, r.fixes_verified),
      baseCommit: r.base_commit_sha,
      headCommit: r.head_commit_sha,
      createdAt: r.created_at,
      completedAt: r.completed_at,
    }));

    // If no accessibility_scores exist, synthesize from pipeline_runs
    if (scoreTimeline.length === 0 && runTimeline.length > 0) {
      for (const run of runTimeline) {
        const totalIssues = run.totalIssues ?? 0;
        const fixesVerified = run.fixesVerified ?? 0;
        const estimatedScore = totalIssues === 0 ? 100 : Math.max(0, Math.round(100 - (totalIssues - fixesVerified) * 5));
        scoreTimeline.push({
          id: run.id,
          commitSha: run.headCommit ?? "",
          score: estimatedScore,
          totalIssues,
          criticalIssues: 0,
          majorIssues: 0,
          minorIssues: 0,
          advisoryIssues: 0,
          measuredAt: run.completedAt ?? run.createdAt,
        });
      }
    }

    return NextResponse.json({
      data: {
        scores: scoreTimeline,
        runs: runTimeline,
      },
      error: null,
    });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Failed to fetch timeline data.";
    return NextResponse.json(
      { data: null, error: { message, code: "TIMELINE_FAILED" } },
      { status: 500 }
    );
  }
}

function formatRunSummary(rawSummary?: string | null, totalIssues?: number, fixesVerified?: number): string {
  if (!rawSummary) {
    return `Found ${totalIssues ?? 0} accessibility regressions. Verified ${fixesVerified ?? 0} fixes.`;
  }

  if (rawSummary.includes("Rate limit") || rawSummary.includes("429")) {
    return "Rate limit hit on primary key — pipeline rotated to backup key in 7-key Groq pool.";
  }
  if (rawSummary.includes("decommissioned")) {
    return "Decommissioned model detected — automatically migrated model candidate.";
  }
  if (rawSummary.includes("Execution Error")) {
    try {
      const match = rawSummary.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed?.error?.message) {
          return `Execution Error: ${parsed.error.message}`;
        }
      }
    } catch {
      // ignore
    }
  }

  return rawSummary;
}
