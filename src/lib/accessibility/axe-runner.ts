import axe from "axe-core";
import { chromium } from "playwright";
import type { AccessibilityViolation } from "@/agents/accessibility-analysis-agent";
import { getWcagRule } from "./rules";

interface PatchInput {
  filename: string;
  patch: string;
  status?: string;
}

interface AddedMarkup {
  filename: string;
  lineNumber: number;
  markup: string;
}

interface AxeAuditResult {
  violations: AccessibilityViolation[];
  ran: boolean;
  reason: string | null;
}

interface BrowserAxeViolation {
  id: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  help: string;
  description: string;
  html: string;
}

const SUPPORTED_RULES = new Set(["image-alt", "button-name", "label"]);

/**
 * Runs axe-core in an isolated Chromium document for markup newly introduced
 * by a diff. Every added line is evaluated independently so axe findings can
 * retain an exact repository path and line number without requiring a local
 * clone or starting an untrusted repository preview server.
 */
export async function scanAddedMarkupWithAxe(patches: PatchInput[]): Promise<AxeAuditResult> {
  const markupLines = extractAddedMarkup(patches);
  if (markupLines.length === 0) return { violations: [], ran: true, reason: null };

  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (caught: unknown) {
    try {
      // A local Chrome installation is a practical fallback when the
      // Playwright-managed browser has not yet been downloaded.
      browser = await chromium.launch({ channel: "chrome", headless: true });
    } catch {
      return {
        violations: [],
        ran: false,
        reason: caught instanceof Error ? caught.message : "Chromium could not be started.",
      };
    }
  }

  try {
    const page = await browser.newPage();
    const violations: AccessibilityViolation[] = [];

    for (const item of markupLines) {
      await page.setContent(`<main data-accessdiff-root="true">${toAuditableHtml(item.markup)}</main>`);
      await page.addScriptTag({ content: axe.source });
      const findings = await page.evaluate(async (): Promise<BrowserAxeViolation[]> => {
        const results = await axe.run(document, {
          runOnly: { type: "rule", values: [...SUPPORTED_RULES] },
        });
        return results.violations.flatMap((violation) => violation.nodes.map((node) => ({
          id: violation.id,
          impact: violation.impact ?? null,
          help: violation.help,
          description: violation.description,
          html: node.html,
        })));
      });

      for (const finding of findings) {
        const wcag = getWcagRule(finding.id);
        if (!wcag) continue;
        violations.push({
          id: `${item.filename}:${item.lineNumber}:${finding.id}`,
          wcagId: wcag.id,
          wcagLevel: wcag.level,
          title: finding.help,
          severity: severityFromImpact(finding.impact),
          filePath: item.filename,
          lineNumber: item.lineNumber,
          snippet: finding.html || item.markup,
          ruleId: finding.id,
          description: finding.description,
        });
      }
    }

    return { violations, ran: true, reason: null };
  } catch (caught: unknown) {
    return {
      violations: [],
      ran: false,
      reason: caught instanceof Error ? caught.message : "axe-core audit failed.",
    };
  } finally {
    await browser.close();
  }
}

function extractAddedMarkup(patches: PatchInput[]): AddedMarkup[] {
  const markup: AddedMarkup[] = [];

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
        if (/<(?:img|button|input)\b/i.test(addedCode)) {
          markup.push({ filename: patch.filename, lineNumber, markup: addedCode });
        }
      } else if (!line.startsWith("-")) {
        lineNumber += 1;
      }
    }
  }

  return markup;
}

function toAuditableHtml(markup: string): string {
  // JSX expressions and event handlers are not valid browser HTML. Replace
  // them with inert values solely for the isolated accessibility audit.
  return markup
    .replace(/\{[^}]*\}/g, "\"accessdiff-value\"")
    .replace(/\s+on[A-Z][A-Za-z]*=\"accessdiff-value\"/g, "")
    .replace(/className=/g, "class=")
    .replace(/htmlFor=/g, "for=");
}

function severityFromImpact(impact: BrowserAxeViolation["impact"]): AccessibilityViolation["severity"] {
  if (impact === "critical") return "CRITICAL";
  if (impact === "serious") return "MAJOR";
  if (impact === "moderate") return "MINOR";
  return "ADVISORY";
}
