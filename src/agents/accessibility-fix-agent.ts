import { BaseAgent, type AgentOutput } from "./base";
import { generateCompletion } from "@/lib/ai/groq";
import type { EnrichedViolation } from "./accessibility-explanation-agent";

export interface GeneratedFix {
  violationId: string;
  filePath: string;
  beforeCode: string;
  afterCode: string;
  gitPatch: string;
  explanation: string;
  trustScore: number; // 0-100
}

export interface FixInput {
  enrichedViolations: EnrichedViolation[];
  patches: Array<{ filename: string; patch: string; status: string }>;
}

export interface FixOutput {
  fixes: GeneratedFix[];
  totalFixes: number;
}

export class AccessibilityFixAgent extends BaseAgent<FixInput, FixOutput> {
  public readonly name = "AccessibilityFixAgent";
  public readonly role = "Generates precise, minimal git patches and code fixes for WCAG violations";

  public async run(input: FixInput): Promise<AgentOutput<FixOutput>> {
    return this.executeTimed(async () => {
      if (!input.enrichedViolations || input.enrichedViolations.length === 0) {
        return {
          data: { fixes: [], totalFixes: 0 },
          confidence: 1.0,
          reasoning: "No violations requiring fixes.",
        };
      }

      const prompt = `
You are the AccessibilityFixAgent of AccessDiff.
Generate minimal, production-ready code fixes for each WCAG violation below.
Ensure fixes preserve original code formatting and business logic, modifying ONLY accessibility attributes and elements.

Violations & Code Context:
${JSON.stringify(input.enrichedViolations, null, 2)}

Return JSON:
{
  "fixes": [
    {
      "violationId": "id",
      "filePath": "path",
      "beforeCode": "original snippet",
      "afterCode": "fixed snippet with WCAG compliant attributes",
      "gitPatch": "git diff patch format",
      "explanation": "brief note on what was modified",
      "trustScore": confidence rating between 0 and 100
    }
  ]
}
`;

      const result = await generateCompletion<{ fixes: GeneratedFix[] }>(prompt, {
        systemPrompt: "You are a expert AI code generator specializing in semantic HTML, ARIA, and React accessibility fixes.",
        responseFormat: { type: "json_object" },
        temperature: 0.1,
      });

      const fixes = result.fixes || [];

      return {
        data: {
          fixes,
          totalFixes: fixes.length,
        },
        confidence: 0.92,
        reasoning: `Generated ${fixes.length} AI fixes for ${input.enrichedViolations.length} detected accessibility violations.`,
      };
    });
  }
}
