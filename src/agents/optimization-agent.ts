import { BaseAgent, type AgentOutput } from "./base";
import { generateCompletion } from "@/lib/ai/groq";
import type { DiagnosisReport } from "./diagnosis-agent";
import type { GeneratedFix } from "./accessibility-fix-agent";

export interface OptimizationInput {
  diagnoses: DiagnosisReport[];
  fixes: GeneratedFix[];
}

export interface OptimizationOutput {
  optimizedFixes: GeneratedFix[];
}

export class OptimizationAgent extends BaseAgent<OptimizationInput, OptimizationOutput> {
  public readonly name = "OptimizationAgent";
  public readonly role = "Refines failed accessibility fixes using diagnosis guidance";

  public async run(input: OptimizationInput): Promise<AgentOutput<OptimizationOutput>> {
    return this.executeTimed(async () => {
      if (input.diagnoses.length === 0) {
        return {
          data: { optimizedFixes: [] },
          confidence: 100,
          reasoning: "No failed fixes require optimization.",
        };
      }

      const result = await generateCompletion<OptimizationOutput>(
        `Optimize only the generated fixes identified by these diagnoses. Preserve business behavior, produce a complete unified patch, and retain the original violationId. Return a JSON object matching { "optimizedFixes": GeneratedFix[] }.\n\nDiagnoses:\n${JSON.stringify(input.diagnoses)}\n\nOriginal fixes:\n${JSON.stringify(input.fixes)}`,
        {
          systemPrompt: "You are AccessDiff's OptimizationAgent. Produce minimal, valid WCAG 2.2 accessibility corrections.",
          responseFormat: { type: "json_object" },
          temperature: 0.1,
        }
      );

      const optimizedFixes = result.optimizedFixes ?? [];
      return {
        data: { optimizedFixes },
        confidence: 90,
        reasoning: `Optimized ${optimizedFixes.length} fixes after diagnosis.`,
      };
    });
  }
}
