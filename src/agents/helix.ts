import type { AgentOutput } from "./base";
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
 * Local implementation of Mutagent's ADL model. The installed SDK supplies
 * workspace and agent management; this orchestrator owns application-specific
 * sequencing and preserves a typed governance trail for later persistence.
 */
export class HelixOrchestrator {
  private readonly agents: HelixAgents;

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

    try {
      const repositoryResult = await this.agents.repository.run(input.repository);
      this.record("SPEC", repositoryResult, stages, decisions, this.agents.repository.name);
      repository = this.requireData(repositoryResult);

      const diffResult = await this.agents.gitDiff.run(input.gitDiff);
      this.record("SPEC", diffResult, stages, decisions, this.agents.gitDiff.name);
      diff = this.requireData(diffResult);

      const analysisInput: AnalysisInput = { patches: diff.patches };
      const analysisResult = await this.agents.analysis.run(analysisInput);
      this.record("BUILD", analysisResult, stages, decisions, this.agents.analysis.name);
      analysis = this.requireData(analysisResult);

      const explanationResult = await this.agents.explanation.run({ violations: analysis.violations });
      this.record("BUILD", explanationResult, stages, decisions, this.agents.explanation.name);
      explanations = this.requireData(explanationResult);

      const fixResult = await this.agents.fix.run({
        enrichedViolations: explanations.enrichedViolations,
        patches: diff.patches,
      });
      this.record("BUILD", fixResult, stages, decisions, this.agents.fix.name);
      fixes = this.requireData(fixResult).fixes;

      for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
        const verificationResult = await this.agents.verification.run({ fixes });
        this.record("EVALUATE", verificationResult, stages, decisions, this.agents.verification.name);
        verification = this.requireData(verificationResult);

        if (verification.allVerified) {
          break;
        }

        const failedVerifications = verification.results.filter((result) => !result.verified);
        if (iteration === maxIterations || failedVerifications.length === 0) {
          break;
        }

        const diagnosisResult = await this.agents.diagnosis.run({ failedVerifications, fixes });
        this.record("DIAGNOSE", diagnosisResult, stages, decisions, this.agents.diagnosis.name);
        const diagnosis: DiagnosisOutput = this.requireData(diagnosisResult);

        const optimizationResult = await this.agents.optimization.run({ diagnoses: diagnosis.diagnoses, fixes });
        this.record("OPTIMIZE", optimizationResult, stages, decisions, this.agents.optimization.name);
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
    this.record("GOVERNANCE", governanceResult, stages, decisions, this.agents.governance.name);
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
    agentName: string
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
