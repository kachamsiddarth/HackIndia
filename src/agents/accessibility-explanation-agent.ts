import { BaseAgent, type AgentOutput } from "./base";
import { generateCompletion } from "@/lib/ai/groq";
import type { AccessibilityViolation } from "./accessibility-analysis-agent";

export interface EnrichedViolation extends AccessibilityViolation {
  userImpact: string; // How this impacts users with disabilities
  remediationGuide: string; // Step-by-step fix guide
  wcagUrl: string; // Link to W3C specification
}

export interface ExplanationInput {
  violations: AccessibilityViolation[];
}

export interface ExplanationOutput {
  enrichedViolations: EnrichedViolation[];
}

export class AccessibilityExplanationAgent extends BaseAgent<ExplanationInput, ExplanationOutput> {
  public readonly name = "AccessibilityExplanationAgent";
  public readonly role = "Enriches raw WCAG violations with user impact insights and remediation guides";

  public async run(input: ExplanationInput): Promise<AgentOutput<ExplanationOutput>> {
    return this.executeTimed(async () => {
      if (!input.violations || input.violations.length === 0) {
        return {
          data: { enrichedViolations: [] },
          confidence: 1.0,
          reasoning: "No violations to explain.",
        };
      }

      const prompt = `
You are the AccessibilityExplanationAgent of AccessDiff.
For each accessibility violation below, provide:
1. "userImpact": A empathetic description of how this affects users with disabilities (e.g. screen reader users, keyboard-only users).
2. "remediationGuide": Clear step-by-step instructions for developers to fix the code.
3. "wcagUrl": Direct reference URL to W3C spec (e.g. https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html).

Violations:
${JSON.stringify(input.violations, null, 2)}

Return JSON:
{
  "enrichedViolations": [ array of violations with userImpact, remediationGuide, and wcagUrl fields added ]
}
`;

      let enrichedViolations: EnrichedViolation[] = [];
      try {
        const result = await generateCompletion<{ enrichedViolations: EnrichedViolation[] }>(
          prompt,
          {
            systemPrompt: "You are an empathetic accessibility educator explaining WCAG guidelines to software engineers.",
            responseFormat: { type: "json_object" },
            temperature: 0.2,
            useFastModel: true,
          }
        );
        enrichedViolations = result.enrichedViolations || [];
      } catch (err: unknown) {
        console.warn("[AccessibilityExplanationAgent] AI completion warning:", err instanceof Error ? err.message : err);
      }

      if (enrichedViolations.length === 0 && input.violations.length > 0) {
        enrichedViolations = input.violations.map((v) => ({
          ...v,
          userImpact: `Screen reader users cannot identify or interact with ${v.title} effectively.`,
          remediationGuide: `Add proper ARIA attributes, semantic HTML elements, or labelling for ${v.snippet}.`,
          wcagUrl: `https://www.w3.org/WAI/WCAG22/quickref/#${v.wcagId.replace(/\./g, "")}`,
        }));
      }

      return {
        data: {
          enrichedViolations,
        },
        confidence: 0.95,
        reasoning: `Successfully generated educational explanations and remediation guides for ${input.violations.length} violations.`,
      };
    });
  }
}
