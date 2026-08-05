import { NextResponse } from "next/server";
import { GitHubClient } from "@/lib/github/client";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
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

    // Get user github_token
    const { data: dbUser } = await admin
      .from("users")
      .select("github_token")
      .eq("id", user.id)
      .single();

    if (!dbUser?.github_token) {
      return NextResponse.json(
        { data: null, error: { message: "GitHub token missing.", code: "GITHUB_TOKEN_MISSING" } },
        { status: 400 }
      );
    }

    // Fetch project
    const { data: project, error: projErr } = await admin
      .from("projects")
      .select("github_repo, default_branch")
      .eq("id", projectId)
      .single();

    if (projErr || !project) {
      return NextResponse.json(
        { data: null, error: { message: "Project not found.", code: "PROJECT_NOT_FOUND" } },
        { status: 404 }
      );
    }

    const [owner, repo] = project.github_repo.split("/");
    const github = new GitHubClient(dbUser.github_token);

    // Fetch GitHub file tree
    const tree = await github.getFileTree(owner, repo, project.default_branch ?? "main");

    // Fetch open issues for this project to attach issue count per file path
    const { data: issues } = await admin
      .from("issues")
      .select("file_path, severity")
      .eq("project_id", projectId);

    const issuesByFile = new Map<string, number>();
    if (issues) {
      for (const iss of issues) {
        issuesByFile.set(iss.file_path, (issuesByFile.get(iss.file_path) ?? 0) + 1);
      }
    }

    const filesWithIssues = tree.map((item) => ({
      path: item.path,
      type: item.type,
      issueCount: issuesByFile.get(item.path) ?? 0,
    }));

    return NextResponse.json({
      data: {
        repo: project.github_repo,
        branch: project.default_branch ?? "main",
        files: filesWithIssues,
      },
      error: null,
    });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Failed to fetch file tree.";
    return NextResponse.json(
      { data: null, error: { message, code: "FILE_TREE_FAILED" } },
      { status: 500 }
    );
  }
}
