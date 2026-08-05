import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GitHubClient } from "@/lib/github/client";
import { RepositoryAgent } from "@/agents/repository-agent";

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

  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { data: null, error: { message: error.message, code: "DB_FETCH_FAILED" } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: projects, error: null });
}

export async function POST(request: Request) {
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
    const body = await request.json();
    const { repo_name } = body; // e.g. "octocat/Hello-World"

    if (!repo_name || typeof repo_name !== "string" || !repo_name.includes("/")) {
      return NextResponse.json(
        { data: null, error: { message: "Invalid repository name format. Expected 'owner/repo'.", code: "INVALID_REPO" } },
        { status: 400 }
      );
    }

    const [owner, repo] = repo_name.split("/");

    // Fetch user token
    const { data: profile } = await supabase
      .from("users")
      .select("github_token")
      .eq("id", user.id)
      .single();

    const token = profile?.github_token || process.env.GITHUB_CLIENT_SECRET;
    const github = new GitHubClient(token || "");

    // 1. Fetch repo info
    const repoDetails = await github.getRepo(owner, repo);

    // 2. Fetch file tree
    const fileTree = await github.getFileTree(owner, repo, repoDetails.default_branch);
    const filePaths = fileTree.map((f) => f.path);

    // 3. Try reading package.json
    let packageJson: string | undefined;
    try {
      packageJson = await github.getFileContent(owner, repo, "package.json");
    } catch {
      // package.json might not exist for non-node projects
    }

    // 4. Run RepositoryAgent analysis
    const agent = new RepositoryAgent();
    let analysis;
    try {
      analysis = await agent.analyzeRepository(repo_name, filePaths, packageJson);
    } catch (err) {
      console.warn("AI analysis fallback:", err);
      analysis = {
        framework: repoDetails.language || "Web Project",
        language: repoDetails.language || "HTML",
        componentCount: filePaths.length,
        riskAreas: [],
        aiSummary: `Repository imported from GitHub. Default branch: ${repoDetails.default_branch}.`,
        accessibilityScoreEstimate: 100,
      };
    }

    // 5. Save project to database
    const { data: project, error: dbError } = await supabase
      .from("projects")
      .upsert({
        user_id: user.id,
        github_repo: repo_name,
        name: repoDetails.name,
        default_branch: repoDetails.default_branch,
        framework: analysis.framework,
        tech_stack: {
          language: analysis.language,
          componentCount: analysis.componentCount,
          stars: repoDetails.stargazers_count,
        },
        risk_areas: analysis.riskAreas,
        ai_summary: analysis.aiSummary,
        accessibility_score: analysis.accessibilityScoreEstimate,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    return NextResponse.json({ data: project, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to import project";
    return NextResponse.json(
      { data: null, error: { message, code: "IMPORT_FAILED" } },
      { status: 500 }
    );
  }
}
