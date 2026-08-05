import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GitHubClient } from "@/lib/github/client";

export async function GET() {
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

  // Retrieve stored GitHub OAuth token from user profile
  const { data: profile } = await supabase
    .from("users")
    .select("github_token")
    .eq("id", user.id)
    .single();

  const token = profile?.github_token || process.env.GITHUB_CLIENT_SECRET;

  if (!token) {
    return NextResponse.json(
      { data: null, error: { message: "GitHub access token missing. Please sign in again.", code: "NO_GITHUB_TOKEN" } },
      { status: 400 }
    );
  }

  try {
    const github = new GitHubClient(token);
    const repos = await github.getUserRepos();

    return NextResponse.json({
      data: repos,
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch repositories";
    return NextResponse.json(
      { data: null, error: { message, code: "GITHUB_FETCH_FAILED" } },
      { status: 500 }
    );
  }
}
