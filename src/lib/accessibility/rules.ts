export interface WcagRule {
  id: string;
  name: string;
  level: "A" | "AA";
  url: string;
}

const WCAG_RULES: Record<string, WcagRule> = {
  "image-alt": {
    id: "1.1.1",
    name: "Non-text Content",
    level: "A",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html",
  },
  "button-name": {
    id: "4.1.2",
    name: "Name, Role, Value",
    level: "A",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html",
  },
  "label": {
    id: "3.3.2",
    name: "Labels or Instructions",
    level: "A",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html",
  },
  "click-events-have-key-events": {
    id: "2.1.1",
    name: "Keyboard",
    level: "A",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html",
  },
};

export function getWcagRule(ruleId: string): WcagRule | null {
  return WCAG_RULES[ruleId] ?? null;
}
