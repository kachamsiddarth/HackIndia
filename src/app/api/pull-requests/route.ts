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

    const admin = createAdminClient();

    let query = admin
      .from("pull_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data: prs, error: prErr } = await query;
    if (prErr) throw new Error(prErr.message);

    const records = (prs ?? []).map((pr) => ({
      id: pr.id,
      pipelineRunId: pr.pipeline_run_id,
      projectId: pr.project_id,
      prNumber: pr.github_pr_number,
      prUrl: pr.github_pr_url,
      title: pr.title,
      status: pr.status,
      filesModified: pr.files_modified,
      issuesAddressed: pr.issues_addressed,
      scoreImprovement: pr.score_improvement,
      createdAt: pr.created_at,
    }));

    return NextResponse.json({ data: { pullRequests: records }, error: null });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Failed to fetch pull requests.";
    return NextResponse.json(
      { data: null, error: { message, code: "PR_LIST_FAILED" } },
      { status: 500 }
    );
  }
}
