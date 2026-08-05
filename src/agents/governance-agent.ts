import { createHash } from "node:crypto";
import { BaseAgent, type AgentOutput } from "./base";

export interface GovernanceDecision {
  agentName: string;
  action: string;
  confidence: number;
  reasoning: string;
  output: unknown;
}

export interface GovernanceRecord extends GovernanceDecision {
  id: string;
  recordedAt: string;
}

export interface GovernanceInput {
  pipelineId: string;
  decisions: GovernanceDecision[];
}

export interface GovernanceOutput {
  records: GovernanceRecord[];
}

export class GovernanceAgent extends BaseAgent<GovernanceInput, GovernanceOutput> {
  public readonly name = "GovernanceAgent";
  public readonly role = "Creates an immutable, structured audit record for every pipeline decision";

  public async run(input: GovernanceInput): Promise<AgentOutput<GovernanceOutput>> {
    return this.executeTimed(async () => {
      const recordedAt = new Date().toISOString();
      const records = input.decisions.map((decision, index) => ({
        ...decision,
        id: createHash("sha256")
          .update(`${input.pipelineId}:${index}:${decision.agentName}:${decision.action}:${recordedAt}`)
          .digest("hex"),
        recordedAt,
      }));

      return {
        data: { records },
        confidence: 100,
        reasoning: `Created ${records.length} governance records for pipeline ${input.pipelineId}.`,
      };
    });
  }
}
