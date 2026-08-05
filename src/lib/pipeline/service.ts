import { HelixOrchestrator, type HelixPipelineOutput, type HelixStageResult } from "@/agents/helix";
import type { AccessibilityViolation } from "@/agents/accessibility-analysis-agent";
import { GitHubClient } from "@/lib/github/client";
import { createAdminClient } from "@/lib/supabase/server";

export interface PipelineRunRecord {
  id: string;
  project_id: string;
  user_id: string;
  base_commit_sha: string;
  head_commit_sha: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  current_stage: string | null;
  total_issues: number;
  new_issues: number;
  fixes_generated: number;
  fixes_verified: number;
  summary: string | null;
  error_message: string | null;
  created_at: string;
}

interface PipelineProject {
  id: string;
  github_repo: string;
  default_branch: string | null;
}

interface UserProfile {
  github_token: string | null;
}

interface PersistedIssue {
  id: string;
  raw_rule_id: string | null;
  file_path: string;
  line_number: number | null;
}

export async function createPipelineRun(input: {
  projectId: string;
  userId: string;
  baseCommitSha: string;
  headCommitSha: string;
}): Promise<PipelineRunRecord> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pipeline_runs")
    .insert({
      project_id: input.projectId,
      user_id: input.userId,
      base_commit_sha: input.baseCommitSha,
      head_commit_sha: input.headCommitSha,
      status: "pending",
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Unable to create pipeline run.");
  return data as PipelineRunRecord;
}

export async function executePipeline(runId: string): Promise<void> {
  await updatePipeline(runId, { status: "running", current_stage: "spec", started_at: new Date().toISOString() });

  try {
    const run = await getRunById(runId);
    const project = await getProject(run.project_id);
    const profile = await getUserProfile(run.user_id);
    if (!profile.github_token) throw new Error("GitHub token is unavailable. Sign in again to reconnect GitHub.");

    const [owner, repo] = splitRepository(project.github_repo);
    const github = new GitHubClient(profile.github_token);
    const fileTree = await github.getFileTree(owner, repo, project.default_branch ?? "main");
    let packageJsonContent: string | undefined;
    try {
      packageJsonContent = await github.getFileContent(owner, repo, "package.json", run.head_commit_sha);
    } catch {
      packageJsonContent = undefined;
    }

    const output = await new HelixOrchestrator().run({
      pipelineId: runId,
      repository: {
        repoName: project.github_repo,
        filePaths: fileTree.map((file) => file.path),
        packageJsonContent,
      },
      gitDiff: {
        token: profile.github_token,
        owner,
        repo,
        baseCommit: run.base_commit_sha,
        headCommit: run.head_commit_sha,
      },
      maxVerificationIterations: 3,
    });

    await persistPipelineOutput(run, output);
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Pipeline execution failed.";
    await updatePipeline(runId, {
      status: "failed",
      error_message: message,
      completed_at: new Date().toISOString(),
    });
  }
}

export async function getPipelineForUser(runId: string, userId: string): Promise<PipelineRunRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pipeline_runs")
    .select("*")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data as PipelineRunRecord) : null;
}

export async function getPipelineResults(runId: string, userId: string): Promise<Record<string, unknown> | null> {
  const run = await getPipelineForUser(runId, userId);
  if (!run) return null;
  const admin = createAdminClient();
  const [stages, issues, fixes] = await Promise.all([
    admin.from("pipeline_stages").select("*").eq("pipeline_run_id", runId).order("created_at"),
    admin.from("issues").select("*").eq("pipeline_run_id", runId).order("created_at"),
    admin.from("fixes").select("*").eq("pipeline_run_id", runId).order("created_at"),
  ]);
  if (stages.error || issues.error || fixes.error) {
    throw new Error(stages.error?.message ?? issues.error?.message ?? fixes.error?.message ?? "Unable to read pipeline results.");
  }
  return { run, stages: stages.data ?? [], issues: issues.data ?? [], fixes: fixes.data ?? [] };
}

async function persistPipelineOutput(run: PipelineRunRecord, output: HelixPipelineOutput): Promise<void> {
  const admin = createAdminClient();
  await admin.from("pipeline_stages").insert(output.stages.map((stage) => toStageInsert(run.id, stage)));
  const persistedIssues = await persistIssues(run, output.analysis?.violations ?? []);
  await persistFixes(run.id, output, persistedIssues);
  await persistGovernanceRecords(run, output);

  const verification = output.verification;
  await updatePipeline(run.id, {
    status: output.completed ? "completed" : "failed",
    current_stage: output.completed ? "complete" : "failed",
    total_issues: persistedIssues.length,
    new_issues: persistedIssues.length,
    fixes_generated: output.fixes.length,
    fixes_verified: verification?.passCount ?? 0,
    summary: output.error ?? `Found ${persistedIssues.length} accessibility regressions.`,
    error_message: output.error,
    completed_at: new Date().toISOString(),
  });
}

async function persistIssues(run: PipelineRunRecord, violations: AccessibilityViolation[]): Promise<PersistedIssue[]> {
  if (violations.length === 0) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("issues")
    .insert(violations.map((violation) => ({
      pipeline_run_id: run.id,
      project_id: run.project_id,
      file_path: violation.filePath,
      line_number: violation.lineNumber ?? null,
      severity: violation.severity.toLowerCase(),
      wcag_rule: violation.wcagId,
      wcag_rule_name: violation.title,
      wcag_level: violation.wcagLevel,
      title: violation.title,
      description: violation.description,
      confidence: 78,
      code_snippet: violation.snippet,
      detected_by: "rule-engine",
      raw_rule_id: violation.ruleId,
    })))
    .select("id, raw_rule_id, file_path, line_number");
  if (error) throw new Error(error.message);
  return (data ?? []) as PersistedIssue[];
}

async function persistFixes(
  runId: string,
  output: HelixPipelineOutput,
  issues: PersistedIssue[]
): Promise<void> {
  if (output.fixes.length === 0) return;
  const admin = createAdminClient();
  const verificationByViolation = new Map(
    (output.verification?.results ?? []).map((result) => [result.violationId, result])
  );
  const inserts = output.fixes.flatMap((fix, index) => {
    const issue = findIssueForFix(issues, fix) ?? issues[index];
    if (!issue) return [];
    const verification = verificationByViolation.get(fix.violationId);
    return [{
      issue_id: issue.id,
      pipeline_run_id: runId,
      file_path: fix.filePath,
      before_code: fix.beforeCode,
      after_code: fix.afterCode,
      diff_patch: fix.gitPatch,
      status: verification?.verified ? "verified" : "generated",
      trust_score: fix.trustScore,
      confidence: fix.trustScore,
      reasoning: fix.explanation,
      verification_result: verification ?? null,
    }];
  });
  if (inserts.length === 0) return;
  const { error } = await admin.from("fixes").insert(inserts);
  if (error) throw new Error(error.message);
}

function findIssueForFix(issues: PersistedIssue[], fix: HelixPipelineOutput["fixes"][number]): PersistedIssue | undefined {
  const match = fix.violationId.match(/^(.*):(\d+):([^:]+)$/);
  if (match?.[1] && match[2] && match[3]) {
    const lineNumber = Number.parseInt(match[2], 10);
    const exactIssue = issues.find((issue) =>
      issue.file_path === match[1] && issue.line_number === lineNumber && issue.raw_rule_id === match[3]
    );
    if (exactIssue) return exactIssue;
  }

  const ruleId = fix.violationId.split(":").at(-1);
  return issues.find((issue) => issue.file_path === fix.filePath && issue.raw_rule_id === ruleId);
}

function toStageInsert(runId: string, stage: HelixStageResult): Record<string, unknown> {
  return {
    pipeline_run_id: runId,
    stage_name: stage.stage.toLowerCase(),
    agent_name: stage.agentName,
    status: stage.status === "COMPLETED" ? "completed" : "failed",
    output_data: stage.output,
    error_message: stage.status === "FAILED" ? stage.reasoning : null,
    duration_ms: stage.duration_ms,
  };
}

async function updatePipeline(runId: string, updates: Record<string, unknown>): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("pipeline_runs").update(updates).eq("id", runId);
  if (error) throw new Error(error.message);
}

async function getRunById(runId: string): Promise<PipelineRunRecord> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("pipeline_runs").select("*").eq("id", runId).single();
  if (error || !data) throw new Error(error?.message ?? "Pipeline run not found.");
  return data as PipelineRunRecord;
}

async function getProject(projectId: string): Promise<PipelineProject> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("projects").select("id, github_repo, default_branch").eq("id", projectId).single();
  if (error || !data) throw new Error(error?.message ?? "Project not found.");
  return data as PipelineProject;
}

async function getUserProfile(userId: string): Promise<UserProfile> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("users").select("github_token").eq("id", userId).single();
  if (error || !data) throw new Error(error?.message ?? "User profile not found.");
  return data as UserProfile;
}

function splitRepository(repository: string): [string, string] {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) throw new Error("Project has an invalid GitHub repository identifier.");
  return [owner, repo];
}

async function persistGovernanceRecords(
  run: PipelineRunRecord,
  output: HelixPipelineOutput
): Promise<void> {
  const admin = createAdminClient();

  const stageRecords = output.stages.map((stg) => ({
    pipeline_run_id: run.id,
    agent_name: stg.agentName,
    action: stg.status === "COMPLETED" ? "STAGE_COMPLETED" : "STAGE_FAILED",
    reasoning: stg.reasoning,
    metadata: {
      confidence: stg.confidence ?? 0.9,
      durationMs: stg.duration_ms,
      stage: stg.stage,
      pipelineId: run.id,
      projectId: run.project_id,
    },
  }));

  const governanceAgentRecords = (output.governanceRecords ?? []).map((rec) => ({
    pipeline_run_id: run.id,
    agent_name: rec.agentName,
    action: rec.action,
    reasoning: rec.reasoning,
    metadata: {
      confidence: rec.confidence ?? 0.95,
      pipelineId: run.id,
      projectId: run.project_id,
    },
  }));

  const allInserts = [...stageRecords, ...governanceAgentRecords];
  if (allInserts.length > 0) {
    const { error } = await admin.from("governance_records").insert(allInserts);
    if (error) {
      console.warn("[Pipeline Service] Governance record insert notice:", error.message);
    }
  }
}

