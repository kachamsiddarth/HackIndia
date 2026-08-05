import type { AccessibilityViolation } from "@/agents/accessibility-analysis-agent";
import { getWcagRule } from "./rules";

interface PatchInput {
  filename: string;
  patch: string;
}

export function scanAddedLines(patches: PatchInput[]): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];

  for (const patch of patches) {
    let lineNumber = 0;
    for (const line of patch.patch.split("\n")) {
      const lineMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
      if (lineMatch?.[1]) {
        lineNumber = Number.parseInt(lineMatch[1], 10) - 1;
        continue;
      }
      if (line.startsWith("+") && !line.startsWith("+++")) {
        lineNumber += 1;
        const addedCode = line.slice(1).trim();
        const ruleId = detectRule(addedCode);
        if (ruleId) {
          const wcag = getWcagRule(ruleId);
          if (wcag) {
            violations.push({
              id: `${patch.filename}:${lineNumber}:${ruleId}`,
              wcagId: wcag.id,
              wcagLevel: wcag.level,
              title: violationTitle(ruleId),
              severity: ruleId === "image-alt" ? "MAJOR" : "MAJOR",
              filePath: patch.filename,
              lineNumber,
              snippet: addedCode,
              ruleId,
              description: `${wcag.name}: this newly added line requires an accessibility correction.`,
            });
          }
        }
      } else if (!line.startsWith("-")) {
        lineNumber += 1;
      }
    }
  }

  return violations;
}

function detectRule(code: string): string | null {
  if (/<img\b/i.test(code) && !/\balt\s*=/.test(code)) return "image-alt";
  if (/<(?:div|span)\b[^>]*\bonClick\s*=/.test(code) && !/\bonKey(?:Down|Up|Press)\s*=/.test(code)) {
    return "click-events-have-key-events";
  }
  if (/<button\b[^>]*>\s*<\/(?:button)>/i.test(code) && !/aria-label\s*=/.test(code)) return "button-name";
  if (/<input\b/i.test(code) && !/\b(?:aria-label|aria-labelledby|id)\s*=/.test(code)) return "label";
  return null;
}

function violationTitle(ruleId: string): string {
  const titles: Record<string, string> = {
    "image-alt": "Image is missing alternative text",
    "button-name": "Button has no accessible name",
    label: "Input has no associated label",
    "click-events-have-key-events": "Non-semantic click target lacks keyboard support",
  };
  return titles[ruleId] ?? "Accessibility violation";
}
