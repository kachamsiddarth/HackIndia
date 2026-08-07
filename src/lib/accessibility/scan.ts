import type { AccessibilityViolation } from "@/agents/accessibility-analysis-agent";
import { getWcagRule } from "./rules";

interface PatchInput {
  filename: string;
  patch: string;
  content?: string;
}

export function scanAddedLines(patches: PatchInput[]): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];

  for (const patch of patches) {
    let lineNumber = 0;
    let patchFound = false;

    for (const line of patch.patch.split("\n")) {
      const lineMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
      if (lineMatch?.[1]) {
        lineNumber = Number.parseInt(lineMatch[1], 10) - 1;
        continue;
      }
      if (line.startsWith("+") && !line.startsWith("+++")) {
        lineNumber += 1;
        patchFound = true;
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
              severity: "MAJOR",
              filePath: patch.filename,
              lineNumber,
              snippet: addedCode,
              ruleId,
              description: `${wcag.name}: this code line requires an accessibility correction.`,
            });
          }
        }
      } else if (!line.startsWith("-")) {
        lineNumber += 1;
      }
    }

    // Fallback: If patch is empty or diff contained no additions, scan file content if available
    if (violations.length === 0 && patch.content) {
      let contentLineNumber = 0;
      for (const rawLine of patch.content.split("\n")) {
        contentLineNumber += 1;
        const code = rawLine.trim();
        const ruleId = detectRule(code);
        if (ruleId) {
          const wcag = getWcagRule(ruleId);
          if (wcag) {
            violations.push({
              id: `${patch.filename}:${contentLineNumber}:${ruleId}`,
              wcagId: wcag.id,
              wcagLevel: wcag.level,
              title: violationTitle(ruleId),
              severity: "MAJOR",
              filePath: patch.filename,
              lineNumber: contentLineNumber,
              snippet: code,
              ruleId,
              description: `${wcag.name}: file line requires an accessibility correction.`,
            });
          }
        }
      }
    }
  }

  return violations;
}

function detectRule(code: string): string | null {
  // 1. Missing alt attribute on images
  if (/<img\b/i.test(code) && !/\balt\s*=/i.test(code)) return "image-alt";
  
  // 2. Non-semantic clickable elements lacking keyboard handlers
  if (/<(?:div|span|a|li)\b[^>]*\bonClick\s*=/i.test(code) && !/\bonKey(?:Down|Up|Press)\s*=/i.test(code)) {
    return "click-events-have-key-events";
  }
  
  // 3. Empty or unlabelled buttons
  if (/<button\b[^>]*>(?:\s*|\s*<[^>]+>\s*)*<\/(?:button)>/i.test(code) && !/aria-label\s*=/i.test(code) && !/aria-labelledby\s*=/i.test(code)) return "button-name";
  if (/<button\b/i.test(code) && !/>.+<\/button>/i.test(code) && !/aria-label\s*=/i.test(code) && !/aria-labelledby\s*=/i.test(code)) return "button-name";
  
  // 4. Unlabelled form controls
  if (/<input\b/i.test(code) && !/type\s*=\s*["'](?:hidden|submit|button|reset)["']/i.test(code) && !/\b(?:aria-label|aria-labelledby|id)\s*=/i.test(code)) return "label";
  if (/<(?:select|textarea)\b/i.test(code) && !/\b(?:aria-label|aria-labelledby|id)\s*=/i.test(code)) return "label";

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
