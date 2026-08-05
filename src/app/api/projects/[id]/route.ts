import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GitHubClient, type GitHubCommit } from "@/lib/github/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !project) {
    return NextResponse.json(
      { data: null, error: { message: "Project not found", code: "NOT_FOUND" } },
      { status: 404 }
    );
  }

  // Retrieve user token to fetch live GitHub commits
  const { data: profile } = await supabase
    .from("users")
    .select("github_token")
    .eq("id", user.id)
    .single();

  const token = profile?.github_token || process.env.GITHUB_CLIENT_SECRET;
  let commits: GitHubCommit[] = [];

  if (token && project.github_repo) {
    try {
      const [owner, repo] = project.github_repo.split("/");
      const github = new GitHubClient(token);
      commits = await github.getCommits(owner, repo, 15);
    } catch (err) {
      console.warn("Failed to fetch live GitHub commits:", err);
    }
  }

  return NextResponse.json({
    data: {
      ...project,
      commits,
    },
    error: null,
  });
}
