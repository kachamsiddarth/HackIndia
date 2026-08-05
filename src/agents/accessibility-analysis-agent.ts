import { BaseAgent, type AgentOutput } from "./base";
import { generateCompletion } from "@/lib/ai/groq";
import { scanAddedLines } from "@/lib/accessibility/scan";
import { scanAddedMarkupWithAxe } from "@/lib/accessibility/axe-runner";

export interface AccessibilityViolation {
  id: string;
  wcagId: string; // e.g. "1.1.1"
  wcagLevel: "A" | "AA" | "AAA";
  title: string;
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "ADVISORY";
  filePath: string;
  lineNumber?: number;
  snippet: string;
  ruleId: string; // e.g. "image-alt", "label"
  description: string;
}

export interface AnalysisInput {
  patches: Array<{
    filename: string;
    patch: string;
    status: string;
  }>;
}

export interface AnalysisOutput {
  violations: AccessibilityViolation[];
  totalViolations: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  advisoryCount: number;
}

export class AccessibilityAnalysisAgent extends BaseAgent<AnalysisInput, AnalysisOutput> {
  public readonly name = "AccessibilityAnalysisAgent";
  public readonly role = "Scans git diff patches for newly introduced WCAG 2.2 accessibility violations using rule engines & LLM reasoning";

  public async run(input: AnalysisInput): Promise<AgentOutput<AnalysisOutput>> {
    return this.executeTimed(async () => {
      if (!input.patches || input.patches.length === 0) {
        return {
          data: {
            violations: [],
            totalViolations: 0,
            criticalCount: 0,
            majorCount: 0,
            minorCount: 0,
            advisoryCount: 0,
          },
          confidence: 1.0,
          reasoning: "No UI patches detected in diff to analyze.",
        };
      }

      const ruleBasedViolations = scanAddedLines(input.patches);
      const axeAudit = await scanAddedMarkupWithAxe(input.patches);
      const prompt = `
You are the AccessibilityAnalysisAgent of AccessDiff.
Analyze the following git patch diffs and identify ONLY newly introduced WCAG 2.2 accessibility violations.
Do not flag existing issues that were not modified or added in the diff (look for added '+' lines).

Patches:
${JSON.stringify(input.patches.slice(0, 10), null, 2)}

Return a JSON object:
{
  "violations": [
    {
      "id": "unique-id-1",
      "wcagId": "1.1.1",
      "wcagLevel": "A" | "AA",
      "title": "Short title of violation",
      "severity": "CRITICAL" | "MAJOR" | "MINOR" | "ADVISORY",
      "filePath": "relative path to file",
      "lineNumber": line number if discernible,
      "snippet": "exact code line that causes issue",
      "ruleId": "axe-core rule ID or standard rule ID e.g. image-alt, color-contrast, button-name",
      "description": "Clear technical explanation of why this violates WCAG"
    }
  ]
}
`;

      let aiViolations: AccessibilityViolation[] = [];
      try {
        const result = await generateCompletion<{ violations: AccessibilityViolation[] }>(prompt, {
          systemPrompt: "You are an expert accessibility audit agent strictly enforcing WCAG 2.2 AA standards.",
          responseFormat: { type: "json_object" },
          temperature: 0.1,
        });
        aiViolations = result.violations ?? [];
      } catch {
        // Deterministic checks still produce actionable results when the LLM is unavailable.
      }

      const violations = deduplicateViolations([...ruleBasedViolations, ...axeAudit.violations, ...aiViolations]);
      const criticalCount = violations.filter((v) => v.severity === "CRITICAL").length;
      const majorCount = violations.filter((v) => v.severity === "MAJOR").length;
      const minorCount = violations.filter((v) => v.severity === "MINOR").length;
      const advisoryCount = violations.filter((v) => v.severity === "ADVISORY").length;

      return {
        data: {
          violations,
          totalViolations: violations.length,
          criticalCount,
          majorCount,
          minorCount,
          advisoryCount,
        },
        confidence: aiViolations.length > 0 ? 94 : axeAudit.ran ? 89 : 78,
        reasoning: `Scanned ${input.patches.length} files. Identified ${violations.length} newly introduced WCAG violations (${criticalCount} Critical, ${majorCount} Major). ${axeAudit.ran ? "axe-core evaluated added markup in isolated Chromium." : `axe-core browser audit was unavailable: ${axeAudit.reason ?? "unknown reason"}`}`,
      };
    });
  }
}

function deduplicateViolations(violations: AccessibilityViolation[]): AccessibilityViolation[] {
  const seen = new Set<string>();
  return violations.filter((violation) => {
    const key = `${violation.filePath}:${violation.lineNumber ?? "unknown"}:${violation.ruleId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
