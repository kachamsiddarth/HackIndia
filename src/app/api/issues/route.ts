import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<NextResponse> {
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
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const severity = searchParams.get("severity");
    const search = searchParams.get("search");

    const admin = createAdminClient();

    // Query user's projects first
    const { data: userProjects, error: projErr } = await admin
      .from("projects")
      .select("id, name")
      .eq("user_id", user.id);

    if (projErr) throw new Error(projErr.message);

    const projectIds = (userProjects ?? []).map((p) => p.id);
    const projectNameMap = new Map((userProjects ?? []).map((p) => [p.id, p.name]));

    if (projectIds.length === 0) {
      return NextResponse.json({ data: { issues: [], fixes: [] }, error: null });
    }

    let query = admin
      .from("issues")
      .select("*")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    if (severity && severity !== "all") {
      query = query.eq("severity", severity.toLowerCase());
    }

    const { data: issuesData, error: issuesErr } = await query;
    if (issuesErr) throw new Error(issuesErr.message);

    let issues = issuesData ?? [];

    if (search) {
      const searchLower = search.toLowerCase();
      issues = issues.filter(
        (issue) =>
          issue.title?.toLowerCase().includes(searchLower) ||
          issue.message?.toLowerCase().includes(searchLower) ||
          issue.file_path?.toLowerCase().includes(searchLower) ||
          issue.wcag_rule?.toLowerCase().includes(searchLower)
      );
    }

    // Attach project name
    const enrichedIssues = issues.map((issue) => ({
      id: issue.id,
      ruleId: issue.raw_rule_id ?? issue.wcag_rule,
      wcagCriteria: issue.wcag_rule,
      wcagRuleName: issue.wcag_rule_name,
      wcagLevel: issue.wcag_level,
      severity: issue.severity,
      message: issue.title ?? issue.description ?? issue.wcag_rule_name ?? "Accessibility Issue",
      title: issue.title,
      description: issue.description,
      filePath: issue.file_path,
      lineNumber: issue.line_number,
      codeSnippet: issue.code_snippet,
      projectId: issue.project_id,
      projectName: projectNameMap.get(issue.project_id) ?? "Project",
      pipelineRunId: issue.pipeline_run_id,
      createdAt: issue.created_at,
    }));

    // Fetch related fixes for these issues
    const issueIds = enrichedIssues.map((i) => i.id);
    interface FixRecord {
      id: string;
      issue_id: string;
      status: string;
      diff_patch: string;
      reasoning: string | null;
      file_path: string;
      before_code: string;
      after_code: string;
      trust_score: number | null;
    }
    let fixesData: FixRecord[] = [];
    if (issueIds.length > 0) {
      const { data: fixes } = await admin
        .from("fixes")
        .select("*")
        .in("issue_id", issueIds);
      fixesData = (fixes ?? []) as FixRecord[];
    }

    const formattedFixes = fixesData.map((fix) => ({
      id: fix.id,
      issueId: fix.issue_id,
      status: fix.status,
      diffPatch: fix.diff_patch,
      rationale: fix.reasoning,
      filePath: fix.file_path,
      beforeCode: fix.before_code,
      afterCode: fix.after_code,
      trustScore: fix.trust_score,
    }));

    return NextResponse.json({
      data: {
        issues: enrichedIssues,
        fixes: formattedFixes,
        projects: userProjects ?? [],
      },
      error: null,
    });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Failed to fetch issues.";
    return NextResponse.json(
      { data: null, error: { message, code: "FETCH_ISSUES_FAILED" } },
      { status: 500 }
    );
  }
}
