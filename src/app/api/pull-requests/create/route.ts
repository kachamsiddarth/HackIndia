import { NextResponse } from "next/server";
import { GitHubClient } from "@/lib/github/client";
import { createClient, createAdminClient } from "@/lib/supabase/server";

interface FixRecord {
  id: string;
  file_path: string;
  before_code: string | null;
  after_code: string | null;
  diff_patch: string | null;
  status: string;
}

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

    // Fetch ALL fixes for this pipeline run (not just approved — include generated/verified)
    const { data: fixes } = await admin
      .from("fixes")
      .select("id, file_path, before_code, after_code, diff_patch, status")
      .eq("pipeline_run_id", pipelineRunId);

    const availableFixes: FixRecord[] = (fixes ?? []) as FixRecord[];
    if (availableFixes.length === 0) {
      throw new Error("No accessibility fixes found for this pipeline run. Run the pipeline first.");
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

    // Step 1: Get base branch SHA
    const baseSha = await github.getBranchRef(owner, repo, baseBranch);

    // Step 2: If creating a PR branch, ensure the branch exists
    if (!directCommit) {
      await github.createBranch(owner, repo, branchName, baseSha);
    }

    // Step 3: Group fixes by file_path so we can apply ALL fixes to each file
    const fixesByFile = new Map<string, FixRecord[]>();
    for (const fix of availableFixes) {
      if (!fix.file_path || (!fix.before_code && !fix.after_code)) continue;
      const existing = fixesByFile.get(fix.file_path) || [];
      existing.push(fix);
      fixesByFile.set(fix.file_path, existing);
    }

    if (fixesByFile.size === 0) {
      throw new Error("No fixes with valid before_code/after_code found. The pipeline may need to be re-run.");
    }

    // Step 4: For each file, fetch original content from GitHub, apply ALL fixes, commit
    const modifiedFilesList: string[] = [];

    for (const [filePath, fileFixes] of fixesByFile.entries()) {
      // Fetch the original file content from GitHub
      let originalContent: string;
      try {
        originalContent = await github.getFileContent(owner, repo, filePath, baseBranch);
      } catch {
        console.warn(`[PR API] Could not fetch original file ${filePath} from GitHub. Skipping.`);
        continue;
      }

      // Apply each fix's before_code → after_code replacement sequentially
      let mergedContent = originalContent;
      let appliedCount = 0;

      for (const fix of fileFixes) {
        if (fix.before_code && fix.after_code) {
          // Check if the before_code snippet exists in the current content
          if (mergedContent.includes(fix.before_code)) {
            mergedContent = mergedContent.replace(fix.before_code, fix.after_code);
            appliedCount++;
          } else {
            // Try trimmed match (whitespace differences)
            const trimmedBefore = fix.before_code.trim();
            if (trimmedBefore && mergedContent.includes(trimmedBefore)) {
              mergedContent = mergedContent.replace(trimmedBefore, fix.after_code.trim());
              appliedCount++;
            }
          }
        }
      }

      // Only commit if we actually changed something
      if (appliedCount > 0 && mergedContent !== originalContent) {
        await github.createOrUpdateFile(
          owner,
          repo,
          filePath,
          mergedContent,
          `fix(accessibility): apply ${appliedCount} WCAG 2.2 AA fixes to ${filePath} via AccessDiff`,
          branchName
        );
        modifiedFilesList.push(filePath);
      }
    }

    if (modifiedFilesList.length === 0) {
      throw new Error(
        "Could not apply any fixes — the before_code snippets did not match the current file content on GitHub. " +
        "This can happen if the repository was modified after the pipeline ran. Try re-running the pipeline."
      );
    }

    // Step 5: Build PR body
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
    let prState = directCommit ? "merged" : "open";

    // Step 6: Create PR (if not direct commit)
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
    } else {
      // Direct commit — link to the commit history
      prUrl = `https://github.com/${owner}/${repo}/commits/${baseBranch}`;
    }

    // Step 7: Persist PR record in database
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
        appliedFiles: modifiedFilesList,
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
  return `## 🔍 AccessDiff — Automated Accessibility Fixes

**Pipeline Run:** \`${opts.pipelineRunId.slice(0, 8)}\`

### Summary
- **${opts.issueCount}** WCAG 2.2 accessibility violations detected
- **${opts.fixCount}** AI-generated code fixes applied
- **${opts.files.length}** file(s) updated on GitHub

### Modified Files
${opts.files.map((f) => `- \`${f}\``).join("\n")}

### What Changed
- Added missing \`alt\` attributes to images
- Added \`<label>\` elements for form inputs  
- Added ARIA roles and attributes to interactive elements
- Fixed heading hierarchy
- Improved keyboard navigation support

### WCAG 2.2 AA Compliance
All changes target Level AA conformance per [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

---
*Generated by [AccessDiff](https://github.com/kachamsiddarth/HackIndia) — AI-Powered Accessibility Engineering Platform*
`;
}
