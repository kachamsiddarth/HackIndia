import { NextResponse } from "next/server";
import { GitHubClient } from "@/lib/github/client";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: projectId } = await props.params;
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path");
  const ref = searchParams.get("ref");

  if (!filePath) {
    return NextResponse.json(
      { data: null, error: { message: "File path parameter required.", code: "PATH_REQUIRED" } },
      { status: 400 }
    );
  }

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

    const { data: project } = await admin
      .from("projects")
      .select("github_repo, default_branch")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json(
        { data: null, error: { message: "Project not found.", code: "PROJECT_NOT_FOUND" } },
        { status: 404 }
      );
    }

    const [owner, repo] = project.github_repo.split("/");
    const github = new GitHubClient(dbUser.github_token);

    const branchOrRef = ref ?? project.default_branch ?? "main";
    const content = await github.getFileContent(owner, repo, filePath, branchOrRef);

    // Get issues associated with this specific file
    const { data: issues } = await admin
      .from("issues")
      .select("*")
      .eq("project_id", projectId)
      .eq("file_path", filePath);

    const formattedIssues = (issues ?? []).map((iss) => ({
      id: iss.id,
      lineNumber: iss.line_number,
      severity: iss.severity,
      title: iss.title,
      description: iss.description,
      wcagRule: iss.wcag_rule,
      wcagRuleName: iss.wcag_rule_name,
    }));

    return NextResponse.json({
      data: {
        path: filePath,
        content,
        issues: formattedIssues,
      },
      error: null,
    });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Failed to fetch file content.";
    return NextResponse.json(
      { data: null, error: { message, code: "FILE_CONTENT_FAILED" } },
      { status: 500 }
    );
  }
}
