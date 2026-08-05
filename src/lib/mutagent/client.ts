import { Mutagent } from "@mutagent/sdk";

export const mutagentClient = new Mutagent({
  security: {
    apiKey: process.env.MUTAGENT_API_KEY ?? "",
  },
});

export interface PipelineStageResult {
  stage: "SPEC" | "BUILD" | "EVALUATE" | "DIAGNOSE" | "OPTIMIZE";
  agentName: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  confidence: number;
  output: unknown;
  duration_ms: number;
}
