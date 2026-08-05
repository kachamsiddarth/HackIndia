import { scanAddedMarkupWithAxe } from "../src/lib/accessibility/axe-runner";

const result = await scanAddedMarkupWithAxe([
  {
    filename: "src/components/Profile.tsx",
    patch: "@@ -1,0 +1,2 @@\n+<img src=\"/avatar.png\" />\n+<button></button>",
  },
]);

if (!result.ran) throw new Error(result.reason ?? "axe-core did not run.");
if (!result.violations.some((violation) => violation.ruleId === "image-alt")) {
  throw new Error("axe-core did not detect the missing image alternative text.");
}
if (!result.violations.some((violation) => violation.ruleId === "button-name")) {
  throw new Error("axe-core did not detect the unnamed button.");
}

console.log(`axe-core verified ${result.violations.length} findings in Chromium.`);
