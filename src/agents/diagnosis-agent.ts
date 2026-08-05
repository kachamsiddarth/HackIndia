import { BaseAgent, type AgentOutput } from "./base";
import { generateCompletion } from "@/lib/ai/groq";
import type { FixVerificationResult } from "./verification-agent";
import type { GeneratedFix } from "./accessibility-fix-agent";

export interface DiagnosisReport {
  fixId: string;
  rootCause: string;
  failureCategory: "SYNTAX_ERROR" | "INCOMPLETE_FIX" | "SIDE_EFFECT_REGRESSION" | "INVALID_ARIA";
  recommendedStrategy: string;
}

export interface DiagnosisInput {
  failedVerifications: FixVerificationResult[];
  fixes: GeneratedFix[];
}

export interface DiagnosisOutput {
  diagnoses: DiagnosisReport[];
}

export class DiagnosisAgent extends BaseAgent<DiagnosisInput, DiagnosisOutput> {
  public readonly name = "DiagnosisAgent";
  public readonly role = "Performs root-cause analysis on failed accessibility fixes (DIAGNOSE stage)";

  public async run(input: DiagnosisInput): Promise<AgentOutput<DiagnosisOutput>> {
    return this.executeTimed(async () => {
      if (!input.failedVerifications || input.failedVerifications.length === 0) {
        return {
          data: { diagnoses: [] },
          confidence: 1.0,
          reasoning: "No verification failures to diagnose.",
        };
      }

      const prompt = `
You are the DiagnosisAgent of AccessDiff (DIAGNOSE stage of ADL).
Perform root-cause analysis on the failed verification results below and suggest specific corrections for the OptimizationAgent.

Failed Verifications:
${JSON.stringify(input.failedVerifications, null, 2)}

Original Fixes:
${JSON.stringify(input.fixes, null, 2)}

Return JSON:
{
  "diagnoses": [
    {
      "fixId": "fix-id",
      "rootCause": "Detailed explanation of why the fix failed",
      "failureCategory": "SYNTAX_ERROR" | "INCOMPLETE_FIX" | "SIDE_EFFECT_REGRESSION" | "INVALID_ARIA",
      "recommendedStrategy": "Exact guidance on how to refine the fix"
    }
  ]
}
`;

      const result = await generateCompletion<{ diagnoses: DiagnosisReport[] }>(prompt, {
        systemPrompt: "You are a specialized diagnostic AI agent analyzing why code mutations failed automated verification tests.",
        responseFormat: { type: "json_object" },
        temperature: 0.1,
        useFastModel: true,
      });

      return {
        data: {
          diagnoses: result.diagnoses || [],
        },
        confidence: 0.93,
        reasoning: `Diagnosed ${input.failedVerifications.length} failed fixes and formulated optimization strategies.`,
      };
    });
  }
}
