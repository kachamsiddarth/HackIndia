import { createAdminClient } from "@/lib/supabase/server";
import { GitHubClient } from "@/lib/github/client";
import { HelixOrchestrator } from "@/agents/helix";
import { AccessibilityExplanationAgent } from "@/agents/accessibility-explanation-agent";
import { DiagnosisAgent } from "@/agents/diagnosis-agent";
import { OptimizationAgent } from "@/agents/optimization-agent";
import type { AgentToolType, ActionContext, ActionResult } from "./agent-types";

export class ActionRegistry {
  private static instance: ActionRegistry;

  private constructor() {}

  public static getInstance(): ActionRegistry {
    if (!ActionRegistry.instance) {
      ActionRegistry.instance = new ActionRegistry();
    }
    return ActionRegistry.instance;
  }

  public async executeTool(
    tool: AgentToolType,
    params: Record<string, any>,
    context: ActionContext
  ): Promise<ActionResult> {
    const admin = createAdminClient();

    switch (tool) {
      case "ImportRepositoryTool": {
        // Fetch user GitHub token + username first
        const { data: dbUser } = await admin
          .from("users")
          .select("github_token, github_username")
          .eq("id", context.userId)
          .single();

        if (!dbUser?.github_token) {
          return { success: false, message: "GitHub token missing for user." };
        }

        const userLogin = dbUser.github_username || "kachamsiddarth";
        const github = new GitHubClient(dbUser.github_token);

        // ------------------------------------------------------------------
        // 1. Resolve requested repo -> real owner/repo
        //    Allows free-form inputs: "test2", "test2 repo", "kachamsiddarth/test2"
        // ------------------------------------------------------------------
        let desiredRepo = (params.repoName || context.repoName || "").trim();
        let resolvedOwner: string = userLogin;
        let resolvedRepo: string | undefined;

        if (!desiredRepo || desiredRepo === "user input required") {
          // No repo provided -> pick the most recently updated user repo
          try {
            const userRepos = await github.getUserRepos("updated");
            if (userRepos.length === 0) {
              return {
                success: false,
                message:
                  "No accessible GitHub repositories were found for your account. Please create or star a repo first, or specify the full 'owner/repo' name.",
              };
            }
            const latest = userRepos[0];
            resolvedOwner = latest.owner.login;
            resolvedRepo = latest.name;
            desiredRepo = latest.full_name;
          } catch {
            return {
              success: false,
              message:
                "Could not list your GitHub repositories. Please specify the repository explicitly as 'owner/repo'.",
            };
          }
        } else if (desiredRepo.includes("/")) {
          const [o, r] = desiredRepo.split("/").map((p: string) => p.trim());
          resolvedOwner = o;
          resolvedRepo = r;
        } else {
          // Bare name like "test2" -> fuzzy match against user's actual repo list
          const normalizedQuery = desiredRepo.toLowerCase().replace(/[^a-z0-9]/g, "");
          try {
            const candidates = await github.getUserRepos("updated");
            let best: (typeof candidates)[number] | undefined;
            let bestScore = 0;
            for (const r of candidates) {
              const hay = r.name.toLowerCase().replace(/[^a-z0-9]/g, "");
              if (!hay) continue;
              if (hay === normalizedQuery) {
                best = r;
                bestScore = Infinity;
                break;
              }
              if (hay.includes(normalizedQuery) || normalizedQuery.includes(hay)) {
                const score = hay.length + normalizedQuery.length - Math.abs(hay.length - normalizedQuery.length);
                if (score > bestScore) {
                  best = r;
                  bestScore = score;
                }
              }
            }
            if (best) {
              resolvedOwner = best.owner.login;
              resolvedRepo = best.name;
              desiredRepo = best.full_name;
            } else {
              resolvedRepo = desiredRepo;
            }
          } catch {
            resolvedRepo = desiredRepo;
          }
        }

        const repoName = `${resolvedOwner}/${resolvedRepo}`;
        const owner = resolvedOwner;
        const repo = resolvedRepo || "";

        if (!owner || !repo) {
          return {
            success: false,
            message:
              "Could not determine which repository to import. Try saying the full name like 'owner/repo-name'.",
          };
        }

        // ------------------------------------------------------------------
        // 2. Fast path: already imported? return the existing project row.
        //    This avoids duplicate-key violations on the (user_id, github_repo)
        //    unique constraint while still giving a UX-friendly answer.
        // ------------------------------------------------------------------
        const { data: existing } = await admin
          .from("projects")
          .select("*")
          .eq("user_id", context.userId)
          .eq("github_repo", repoName)
          .limit(1)
          .maybeSingle();

        if (existing) {
          return {
            success: true,
            message: `Repository ${repoName} is already imported. Accessibility score: ${existing.accessibility_score}%.`,
            data: existing,
            navigationTarget: `/projects/${existing.id}`,
            alreadyImported: true,
          };
        }

        // ------------------------------------------------------------------
        // 3. Fresh import path
        // ------------------------------------------------------------------
        try {
          const repoData = await github.getRepo(owner, repo);
          const defaultBranch = repoData.default_branch || "main";
          const tree = await github.getFileTree(owner, repo, defaultBranch);
          const filePaths = tree.map((f: { path: string }) => f.path);

          let packageJsonContent: string | undefined;
          try {
            packageJsonContent = await github.getFileContent(owner, repo, "package.json", defaultBranch);
          } catch {
            packageJsonContent = undefined;
          }

          // Trigger RepositoryAgent
          const { RepositoryAgent } = await import("@/agents/repository-agent");
          const repoAgent = new RepositoryAgent();
          const agentOutput = await repoAgent.run({
            repoName,
            filePaths,
            packageJsonContent,
          });

          const summary = agentOutput.data;
          if (!summary) throw new Error("Failed to generate repository summary.");

          const { data: inserted, error } = await admin
            .from("projects")
            .upsert(
              {
                user_id: context.userId,
                name: repoData.name,
                github_repo: repoName,
                default_branch: defaultBranch,
                framework: summary.framework,
                tech_stack: {
                  language: summary.language,
                  componentCount: summary.componentCount,
                  stars: repoData.stargazers_count,
                },
                risk_areas: summary.riskAreas,
                ai_summary: summary.aiSummary,
                accessibility_score: summary.accessibilityScoreEstimate,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id, github_repo", ignoreDuplicates: false }
            )
            .select()
            .single();

          if (error) throw new Error(error.message);

          return {
            success: true,
            message: `Repository ${repoName} imported successfully! Initial accessibility score estimate: ${summary.accessibilityScoreEstimate}%.`,
            data: inserted,
            navigationTarget: `/projects/${inserted.id}`,
          };
        } catch (err: any) {
          return { success: false, message: `Failed to import repository ${repoName}: ${err.message}` };
        }
      }

      case "RunPipelineTool": {
        let projectId = params.projectId || context.projectId;

        // If no explicit project ID in context, fetch the latest user project
        if (!projectId) {
          const { data: latestProj } = await admin
            .from("projects")
            .select("id")
            .eq("user_id", context.userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          
          projectId = latestProj?.id;
        }

        if (!projectId) {
          return { success: false, message: "No active or imported project found to run pipeline." };
        }

        const { data: project } = await admin
          .from("projects")
          .select("name, github_repo, default_branch")
          .eq("id", projectId)
          .single();

        if (!project) return { success: false, message: "Project not found." };

        const [owner, repo] = project.github_repo.split("/");

        // Fetch user token
        const { data: dbUser } = await admin
          .from("users")
          .select("github_token")
          .eq("id", context.userId)
          .single();

        if (!dbUser?.github_token) return { success: false, message: "GitHub token required." };

        const github = new GitHubClient(dbUser.github_token);
        const commits = await github.getCommits(owner, repo, 2);

        if (!commits || commits.length < 2) {
          return { success: false, message: `At least 2 commits required for diff in ${project.github_repo}.` };
        }

        const headCommit = params.headCommit || commits[0].sha;
        const baseCommit = params.baseCommit || commits[1].sha;

        // Start pipeline run in DB
        const { data: run, error: insertErr } = await admin
          .from("pipeline_runs")
          .insert({
            project_id: projectId,
            user_id: context.userId,
            base_commit_sha: baseCommit,
            head_commit_sha: headCommit,
            status: "running",
            current_stage: "SPEC",
          })
          .select()
          .single();

        if (insertErr || !run) return { success: false, message: `Failed to initialize pipeline run: ${insertErr?.message}` };

        // Execute Orchestrator
        const orchestrator = new HelixOrchestrator();
        const output = await orchestrator.run({
          pipelineId: run.id,
          repository: {
            repoName: project.github_repo,
            filePaths: ["index.html"],
          },
          gitDiff: {
            token: dbUser.github_token,
            owner,
            repo,
            baseCommit,
            headCommit,
          },
        });

        return {
          success: true,
          message: `Pipeline execution completed for ${project.github_repo}. Discovered ${output.analysis?.totalViolations ?? 0} issues, generated ${output.fixes.length ?? 0} fixes!`,
          data: output,
          navigationTarget: `/projects/${projectId}/timeline`,
        };
      }

      case "CreatePRTool": {
        const pipelineRunId = params.pipelineRunId || context.pipelineRunId;
        const projectId = params.projectId || context.projectId;

        if (!pipelineRunId || !projectId) {
          return { success: false, message: "Pipeline Run ID and Project ID are required to create PR." };
        }

        const title = params.title || "AccessDiff: Automated Accessibility Fixes";
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/pull-requests/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, pipelineRunId, title, directCommit: params.directCommit ?? false }),
        });

        const resJson = await response.json();
        if (resJson.error) {
          return { success: false, message: resJson.error.message };
        }

        return {
          success: true,
          message: `Pull Request created successfully! URL: ${resJson.data.prUrl}`,
          data: resJson.data,
        };
      }

      case "ExplainViolationTool": {
        const violationId = params.violationId;
        const { data: issue } = await admin
          .from("issues")
          .select("*")
          .eq("id", violationId)
          .single();

        if (!issue) {
          return { success: false, message: "Violation issue not found." };
        }

        const explanationAgent = new AccessibilityExplanationAgent();
        const output = await explanationAgent.run({
          violations: [
            {
              id: issue.id,
              wcagId: issue.wcag_rule,
              wcagLevel: issue.wcag_level || "AA",
              title: issue.title,
              severity: issue.severity?.toUpperCase() || "MAJOR",
              filePath: issue.file_path,
              lineNumber: issue.line_number,
              snippet: issue.code_snippet || "",
              ruleId: issue.raw_rule_id || "accessibility",
              description: issue.description || "",
            },
          ],
        });

        const enriched = output.data?.enrichedViolations?.[0];
        return {
          success: true,
          message: `**${issue.title}** (${issue.wcag_rule}):\n\n**User Impact:** ${enriched?.userImpact || issue.description}\n\n**Remediation Guide:** ${enriched?.remediationGuide || "See WCAG 2.2 guidelines."}`,
          data: enriched,
        };
      }

      case "OptimizeFixesTool": {
        const pipelineRunId = params.pipelineRunId || context.pipelineRunId;
        if (!pipelineRunId) return { success: false, message: "Pipeline Run ID required to optimize fixes." };

        const { data: fixes } = await admin
          .from("fixes")
          .select("*")
          .eq("pipeline_run_id", pipelineRunId);

        if (!fixes || fixes.length === 0) return { success: false, message: "No fixes found for optimization." };

        const diagnosisAgent = new DiagnosisAgent();
        const diagOutput = await diagnosisAgent.run({
          failedVerifications: fixes.map((f: any) => ({
            fixId: f.id,
            violationId: f.issue_id || f.id,
            verified: false,
            residualViolationsCount: 1,
            notes: "Requires optimization pass",
          })),
          fixes: fixes.map((f: any) => ({
            violationId: f.issue_id || f.id,
            filePath: f.file_path,
            beforeCode: f.before_code || "",
            afterCode: f.after_code || "",
            gitPatch: f.diff_patch || "",
            explanation: "Initial fix",
            trustScore: 80,
          })),
        });

        const optAgent = new OptimizationAgent();
        const optOutput = await optAgent.run({
          diagnoses: diagOutput.data?.diagnoses || [],
          fixes: fixes.map((f: any) => ({
            violationId: f.issue_id || f.id,
            filePath: f.file_path,
            beforeCode: f.before_code || "",
            afterCode: f.after_code || "",
            gitPatch: f.diff_patch || "",
            explanation: "Initial fix",
            trustScore: 80,
          })),
        });

        return {
          success: true,
          message: `Optimization pass completed! Regenerated and refined ${optOutput.data?.optimizedFixes?.length ?? 0} fixes.`,
          data: optOutput.data,
        };
      }

      case "OpenGovernanceTool":
      case "ViewReportsTool":
      case "NavigateTool": {
        let target = params.target || params.path;
        if (tool === "OpenGovernanceTool") target = "/governance";
        if (tool === "ViewReportsTool") target = "/issues";
        if (!target || target === "/projects/governance") target = "/governance";

        return {
          success: true,
          message: `Navigating to ${target}...`,
          navigationTarget: target,
        };
      }

      case "SelectRepositoryTool":
      case "SelectCommitsTool": {
        return {
          success: true,
          message: `Context updated: Repository set to ${params.repoName || context.repoName}.`,
          data: params,
        };
      }

      default:
        return { success: false, message: `Tool ${tool} is not registered.` };
    }
  }
}
