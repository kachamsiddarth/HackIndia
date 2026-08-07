import type { AgentOutput } from "./base";
import { mutagentClient, getMutagentWorkspaces } from "@/lib/mutagent/client";
import {
  AccessibilityAnalysisAgent,
  type AnalysisInput,
  type AnalysisOutput,
} from "./accessibility-analysis-agent";
import {
  AccessibilityExplanationAgent,
  type ExplanationOutput,
} from "./accessibility-explanation-agent";
import { AccessibilityFixAgent, type GeneratedFix } from "./accessibility-fix-agent";
import { DiagnosisAgent, type DiagnosisOutput } from "./diagnosis-agent";
import { GitDiffAgent, type GitDiffInput, type GitDiffOutput } from "./git-diff-agent";
import {
  GovernanceAgent,
  type GovernanceDecision,
  type GovernanceRecord,
} from "./governance-agent";
import { OptimizationAgent, type OptimizationOutput } from "./optimization-agent";
import { RepositoryAgent, type RepositoryAgentInput, type RepositorySummary } from "./repository-agent";
import { VerificationAgent, type VerificationOutput } from "./verification-agent";

export type HelixStage = "SPEC" | "BUILD" | "EVALUATE" | "DIAGNOSE" | "OPTIMIZE" | "GOVERNANCE";

export interface HelixStageResult {
  stage: HelixStage;
  agentName: string;
  status: "COMPLETED" | "FAILED";
  confidence: number;
  reasoning: string;
  output: unknown;
  duration_ms: number;
}

export interface HelixPipelineInput {
  pipelineId: string;
  repository: RepositoryAgentInput;
  gitDiff: GitDiffInput;
  maxVerificationIterations?: number;
}

export interface HelixPipelineOutput {
  completed: boolean;
  error: string | null;
  repository: RepositorySummary | null;
  diff: GitDiffOutput | null;
  analysis: AnalysisOutput | null;
  explanations: ExplanationOutput | null;
  fixes: GeneratedFix[];
  verification: VerificationOutput | null;
  stages: HelixStageResult[];
  governanceRecords: GovernanceRecord[];
}

export interface HelixAgents {
  repository: RepositoryAgent;
  gitDiff: GitDiffAgent;
  analysis: AccessibilityAnalysisAgent;
  explanation: AccessibilityExplanationAgent;
  fix: AccessibilityFixAgent;
  verification: VerificationAgent;
  diagnosis: DiagnosisAgent;
  optimization: OptimizationAgent;
  governance: GovernanceAgent;
}

/**
 * Mutagent ADL (Agent Description Language) Orchestrator.
 * Orchestrates multi-agent pipelines and reports every executed stage
 * to the Mutagent platform via the official agents.createAgent API.
 *
 * Telemetry mechanism (confirmed by runtime SDK inspection v0.3.20):
 * - @mutagent/sdk does NOT export initTracing, trace, withTrace, recordStage, or track.
 * - The official ingestion path is mutagentClient.agents.createAgent({ metadata }) with
 *   the x-organization-id and x-workspace-id headers provided per-request.
 * - Organization and workspace IDs are resolved dynamically at run-start.
 */
export class HelixOrchestrator {
  private readonly agents: HelixAgents;
  /** Cached per-run org+workspace context, resolved once at run start. */
  private mutagentOrgId: string | null = null;
  private mutagentWsId: string | null = null;

  public constructor(agents: HelixAgents = HelixOrchestrator.createDefaultAgents()) {
    this.agents = agents;
  }

  public static createDefaultAgents(): HelixAgents {
    return {
      repository: new RepositoryAgent(),
      gitDiff: new GitDiffAgent(),
      analysis: new AccessibilityAnalysisAgent(),
      explanation: new AccessibilityExplanationAgent(),
      fix: new AccessibilityFixAgent(),
      verification: new VerificationAgent(),
      diagnosis: new DiagnosisAgent(),
      optimization: new OptimizationAgent(),
      governance: new GovernanceAgent(),
    };
  }

  /** Resolve org and workspace IDs once per pipeline run. */
  private async resolveMutagentContext(): Promise<void> {
    try {
      const orgs = await mutagentClient.organizations.listOrganizations();
      const orgList = (orgs as unknown as { result?: { data?: Array<{ id?: string }> } }).result?.data ?? [];
      this.mutagentOrgId = orgList[0]?.id ?? null;
      if (this.mutagentOrgId) {
        const wsRes = await getMutagentWorkspaces();
        const wsList = (wsRes as unknown as { workspaces?: Array<{ id?: string }> }).workspaces ?? [];
        this.mutagentWsId = wsList[0]?.id ?? null;
      }
    } catch {
      // Non-fatal: telemetry is best-effort
    }
  }

  public async run(input: HelixPipelineInput): Promise<HelixPipelineOutput> {
    const stages: HelixStageResult[] = [];
    const decisions: GovernanceDecision[] = [];
    const maxIterations = input.maxVerificationIterations ?? 3;
    let repository: RepositorySummary | null = null;
    let diff: GitDiffOutput | null = null;
    let analysis: AnalysisOutput | null = null;
    let explanations: ExplanationOutput | null = null;
    let fixes: GeneratedFix[] = [];
    let verification: VerificationOutput | null = null;
    let error: string | null = null;

    // Resolve Mutagent org/workspace context once at run start (non-blocking)
    await this.resolveMutagentContext();

    try {
      const repositoryResult = await this.agents.repository.run(input.repository);
      this.record("SPEC", repositoryResult, stages, decisions, this.agents.repository.name, input.pipelineId);
      repository = this.requireData(repositoryResult);

      const diffResult = await this.agents.gitDiff.run(input.gitDiff);
      this.record("SPEC", diffResult, stages, decisions, this.agents.gitDiff.name, input.pipelineId);
      diff = this.requireData(diffResult);

      const analysisInput: AnalysisInput = { patches: diff.patches };
      const analysisResult = await this.agents.analysis.run(analysisInput);
      this.record("BUILD", analysisResult, stages, decisions, this.agents.analysis.name, input.pipelineId);
      analysis = this.requireData(analysisResult);

      const explanationResult = await this.agents.explanation.run({ violations: analysis.violations });
      this.record("BUILD", explanationResult, stages, decisions, this.agents.explanation.name, input.pipelineId);
      explanations = this.requireData(explanationResult);

      const fixResult = await this.agents.fix.run({
        enrichedViolations: explanations.enrichedViolations,
        patches: diff.patches,
      });
      this.record("BUILD", fixResult, stages, decisions, this.agents.fix.name, input.pipelineId);
      fixes = this.requireData(fixResult).fixes;

      for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
        const verificationResult = await this.agents.verification.run({ fixes });
        this.record("EVALUATE", verificationResult, stages, decisions, this.agents.verification.name, input.pipelineId);
        verification = this.requireData(verificationResult);

        if (verification.allVerified) {
          break;
        }

        const failedVerifications = verification.results.filter((result) => !result.verified);
        if (iteration === maxIterations || failedVerifications.length === 0) {
          break;
        }

        const diagnosisResult = await this.agents.diagnosis.run({ failedVerifications, fixes });
        this.record("DIAGNOSE", diagnosisResult, stages, decisions, this.agents.diagnosis.name, input.pipelineId);
        const diagnosis: DiagnosisOutput = this.requireData(diagnosisResult);

        const optimizationResult = await this.agents.optimization.run({ diagnoses: diagnosis.diagnoses, fixes });
        this.record("OPTIMIZE", optimizationResult, stages, decisions, this.agents.optimization.name, input.pipelineId);
        const optimization: OptimizationOutput = this.requireData(optimizationResult);
        if (optimization.optimizedFixes.length === 0) {
          break;
        }

        fixes = this.replaceOptimizedFixes(fixes, optimization.optimizedFixes);
      }
    } catch (caught: unknown) {
      error = caught instanceof Error ? caught.message : "Helix pipeline failed.";
    }

    const governanceResult = await this.agents.governance.run({
      pipelineId: input.pipelineId,
      decisions,
    });
    this.record("GOVERNANCE", governanceResult, stages, decisions, this.agents.governance.name, input.pipelineId);
    const governanceRecords = governanceResult.data?.records ?? [];

    return {
      completed: error === null && verification?.allVerified === true,
      error,
      repository,
      diff,
      analysis,
      explanations,
      fixes,
      verification,
      stages,
      governanceRecords,
    };
  }

  private record<T>(
    stage: HelixStage,
    result: AgentOutput<T>,
    stages: HelixStageResult[],
    decisions: GovernanceDecision[],
    agentName: string,
    pipelineId: string
  ): void {
    stages.push({
      stage,
      agentName,
      status: result.success ? "COMPLETED" : "FAILED",
      confidence: result.confidence,
      reasoning: result.reasoning,
      output: result.data,
      duration_ms: result.duration_ms,
    });
    decisions.push({
      agentName,
      action: result.success ? "completed" : "failed",
      confidence: result.confidence,
      reasoning: result.reasoning,
      output: result.data,
    });

    // Report stage telemetry to the Mutagent platform via the official SDK.
    // We maintain persistent, canonical Agent definitions (1 per agent role, e.g., 'accessdiff-repositoryagent')
    // and update their metadata on every run execution to avoid duplicate slug creation.
    if (this.mutagentOrgId) {
      const canonicalSlug = `accessdiff-${agentName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const headers: Record<string, string> = { "x-organization-id": this.mutagentOrgId };
      if (this.mutagentWsId) headers["x-workspace-id"] = this.mutagentWsId;

      const metadata = {
        pipelineId,
        adlcStage: stage,
        agentName,
        status: result.success ? "COMPLETED" : "FAILED",
        confidence: result.confidence,
        durationMs: result.duration_ms,
        reasoning: result.reasoning,
        lastExecutedAt: new Date().toISOString(),
      };

      (async () => {
        try {
          const existingAgent = await mutagentClient.agents.getAgentBySlug({ slug: canonicalSlug }, { headers });
          if (existingAgent && existingAgent.id) {
            await mutagentClient.agents.updateAgent({
              id: existingAgent.id,
              body: {
                name: agentName,
                description: `ADLC ${stage} stage | Last Run: ${pipelineId} | ${result.success ? "COMPLETED" : "FAILED"} in ${result.duration_ms}ms`,
                metadata,
              },
            }, { headers });
          }
        } catch {
          // If agent doesn't exist yet, register it once as the canonical definition
          try {
            await mutagentClient.agents.createAgent({
              name: agentName,
              slug: canonicalSlug,
              systemPrompt: `AccessDiff ADLC agent for ${agentName} (${stage} stage).`,
              description: `ADLC ${stage} stage | Initialized by AccessDiff Pipeline`,
              metadata,
            }, { headers });
          } catch (createErr: unknown) {
            console.warn("[Mutagent] Agent definition creation warning:", createErr instanceof Error ? createErr.message : createErr);
          }
        }
      })().catch((err: unknown) => {
        console.warn("[Mutagent] Stage telemetry sync warning:", err instanceof Error ? err.message : err);
      });
    }
  }

  private requireData<T>(result: AgentOutput<T>): T {
    if (!result.success || result.data === null) {
      throw new Error(result.reasoning);
    }
    return result.data;
  }

  private replaceOptimizedFixes(currentFixes: GeneratedFix[], optimizedFixes: GeneratedFix[]): GeneratedFix[] {
    const optimizedByViolation = new Map(
      optimizedFixes.map((fix) => [fix.violationId, fix] as const)
    );
    return currentFixes.map((fix) => optimizedByViolation.get(fix.violationId) ?? fix);
  }
}

