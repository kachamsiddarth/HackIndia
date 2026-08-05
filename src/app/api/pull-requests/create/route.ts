import { NextResponse } from "next/server";
import { GitHubClient } from "@/lib/github/client";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request): Promise<NextResponse> {
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
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error("Invalid request body.");

    const pipelineRunId = asString(body.pipelineRunId);
    const projectId = asString(body.projectId);
    const title = asString(body.title) || "AccessDiff: Accessibility Fixes";
    const customBody = asString(body.body);
    const directCommit = Boolean(body.directCommit);

    if (!pipelineRunId || !projectId) {
      throw new Error("pipelineRunId and projectId are required.");
    }

    const admin = createAdminClient();

    // Fetch project info
    const { data: project } = await admin
      .from("projects")
      .select("github_repo, default_branch")
      .eq("id", projectId)
      .single();
    if (!project) throw new Error("Project not found.");

    // Fetch user GitHub token
    const { data: dbUser } = await admin
      .from("users")
      .select("github_token")
      .eq("id", user.id)
      .single();
    if (!dbUser?.github_token) throw new Error("GitHub OAuth token missing.");

    // Fetch all generated/verified fixes for this pipeline run
    const { data: fixes } = await admin
      .from("fixes")
      .select("id, file_path, before_code, after_code, diff_patch, status")
      .eq("pipeline_run_id", pipelineRunId);

    const availableFixes = fixes ?? [];
    if (availableFixes.length === 0) {
      throw new Error("No accessibility fixes found for this pipeline run.");
    }

    // Fetch issues count
    const { data: issues } = await admin
      .from("issues")
      .select("id")
      .eq("pipeline_run_id", pipelineRunId);

    const [owner, repo] = project.github_repo.split("/");
    const github = new GitHubClient(dbUser.github_token);
    const baseBranch = project.default_branch || "main";
    const branchName = directCommit ? baseBranch : `accessdiff/fixes-${pipelineRunId.slice(0, 8)}`;

    // 1. Get base branch SHA
    const baseSha = await github.getBranchRef(owner, repo, baseBranch);

    // 2. If creating a PR, ensure the target branch exists
    if (!directCommit) {
      await github.createBranch(owner, repo, branchName, baseSha);
    }

    // 3. Apply fixes to the files on GitHub
    const fileFixMap = new Map<string, string>();
    for (const fix of availableFixes) {
      if (fix.file_path && fix.after_code) {
        fileFixMap.set(fix.file_path, fix.after_code);
      }
    }

    const modifiedFilesList: string[] = [];

    for (const [filePath, afterCode] of fileFixMap.entries()) {
      let finalContent = afterCode;

      // If afterCode is just a partial snippet, merge it with original file content from GitHub
      try {
        const originalContent = await github.getFileContent(owner, repo, filePath, baseBranch);
        if (originalContent && !afterCode.includes("<!DOCTYPE") && !afterCode.includes("<html")) {
          // If original contains file structure, substitute the code
          const fix = availableFixes.find((f) => f.file_path === filePath);
          if (fix?.before_code && originalContent.includes(fix.before_code)) {
            finalContent = originalContent.replace(fix.before_code, afterCode);
          } else if (originalContent.length > afterCode.length && !afterCode.includes("<")) {
            finalContent = originalContent; // fallback if invalid snippet
          }
        }
      } catch {
        // File may be new or unreadable, use afterCode directly
      }

      await github.createOrUpdateFile(
        owner,
        repo,
        filePath,
        finalContent,
        `fix(accessibility): resolve WCAG 2.2 AA violations in ${filePath} via AccessDiff`,
        branchName
      );

      modifiedFilesList.push(filePath);
    }

    // 4. Build PR body
    const prBody =
      customBody ||
      generatePRBody({
        pipelineRunId,
        fixCount: availableFixes.length,
        issueCount: issues?.length ?? 0,
        files: modifiedFilesList,
      });

    let prUrl = `https://github.com/${owner}/${repo}/commits/${branchName}`;
    let prNumber = 0;
    let prState = "open";

    if (!directCommit) {
      try {
        const pr = await github.createPullRequest(owner, repo, {
          title,
          body: prBody,
          head: branchName,
          base: baseBranch,
        });
        prUrl = pr.html_url;
        prNumber = pr.number;
        prState = pr.state;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("A pull request already exists")) {
          prUrl = `https://github.com/${owner}/${repo}/pulls`;
          prState = "open";
        } else {
          throw err;
        }
      }
    }

    // 5. Persist PR record in database
    const { data: prRecord, error: insertErr } = await admin
      .from("pull_requests")
      .insert({
        pipeline_run_id: pipelineRunId,
        project_id: projectId,
        user_id: user.id,
        github_pr_number: prNumber,
        github_pr_url: prUrl,
        title,
        body: prBody,
        status: prState,
        files_modified: modifiedFilesList.length,
        issues_addressed: issues?.length ?? 0,
      })
      .select()
      .single();

    if (insertErr) {
      console.warn("[PR API] Failed to persist PR record:", insertErr.message);
    }

    return NextResponse.json({
      data: {
        id: prRecord?.id ?? null,
        prNumber,
        prUrl,
        title,
        status: prState,
        filesModified: modifiedFilesList.length,
        issuesAddressed: issues?.length ?? 0,
        branchName,
      },
      error: null,
    });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Failed to create pull request.";
    console.error("[PR API Error]", message);
    return NextResponse.json(
      { data: null, error: { message, code: "PR_CREATE_FAILED" } },
      { status: 500 }
    );
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function generatePRBody(opts: {
  pipelineRunId: string;
  fixCount: number;
  issueCount: number;
  files: string[];
}): string {
  return `## 🔍 AccessDiff Accessibility Fixes

**Pipeline Run:** \`${opts.pipelineRunId.slice(0, 8)}\`

### Summary
- **${opts.issueCount}** accessibility violations detected
- **${opts.fixCount}** AI-generated fixes applied to GitHub codebase
- **${opts.files.length}** files updated

### Modified Files
${opts.files.map((f) => `- \`${f}\``).join("\n")}

### WCAG 2.2 AA Compliance
All code changes address color contrast, ARIA roles/labels, form control accessibility, and keyboard navigation support.

---
*Generated by [AccessDiff](https://github.com/kachamsiddarth/HackIndia) — AI-Powered Accessibility Engineering Platform*
`;
}
