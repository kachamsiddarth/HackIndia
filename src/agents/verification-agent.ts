import { BaseAgent, type AgentOutput } from "./base";
import { generateCompletion } from "@/lib/ai/groq";
import type { GeneratedFix } from "./accessibility-fix-agent";

export interface FixVerificationResult {
  fixId: string;
  violationId: string;
  verified: boolean; // true if issue is completely fixed and no regression added
  residualViolationsCount: number;
  notes: string;
}

export interface VerificationInput {
  fixes: GeneratedFix[];
}

export interface VerificationOutput {
  allVerified: boolean;
  results: FixVerificationResult[];
  passCount: number;
  failCount: number;
}

export class VerificationAgent extends BaseAgent<VerificationInput, VerificationOutput> {
  public readonly name = "VerificationAgent";
  public readonly role = "Evaluates generated fixes to verify complete WCAG resolution with zero side-effect regressions";

  public async run(input: VerificationInput): Promise<AgentOutput<VerificationOutput>> {
    return this.executeTimed(async () => {
      if (!input.fixes || input.fixes.length === 0) {
        return {
          data: { allVerified: true, results: [], passCount: 0, failCount: 0 },
          confidence: 1.0,
          reasoning: "No fixes to verify.",
        };
      }

      const prompt = `
You are the VerificationAgent of AccessDiff (EVALUATE stage of ADL).
Re-evaluate each generated fix. Verify whether the new code ("afterCode") completely resolves the WCAG violation and does not introduce any secondary accessibility flaws.

Fixes to Verify:
${JSON.stringify(input.fixes, null, 2)}

Return JSON:
{
  "results": [
    {
      "fixId": "fix-id",
      "violationId": "violation-id",
      "verified": true or false,
      "residualViolationsCount": 0 if clean,
      "notes": "Verification details (e.g. Verified: image now includes appropriate alt attribute)"
    }
  ]
}
`;

      const result = await generateCompletion<{ results: FixVerificationResult[] }>(
        prompt,
        {
          systemPrompt: "You are a strict, objective software verification agent validating accessibility fixes.",
          responseFormat: { type: "json_object" },
          temperature: 0.1,
        }
      );

      const results = result.results || [];
      const passCount = results.filter((r) => r.verified).length;
      const failCount = results.filter((r) => !r.verified).length;

      return {
        data: {
          allVerified: failCount === 0,
          results,
          passCount,
          failCount,
        },
        confidence: 0.96,
        reasoning: `Verified ${input.fixes.length} fixes. ${passCount} passed verification, ${failCount} failed and require diagnosis.`,
      };
    });
  }
}
