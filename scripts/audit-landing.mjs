import axe from "axe-core";
import { chromium } from "playwright";

const target = process.argv[2] ?? "http://127.0.0.1:3000/";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  await page.goto(target, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }));
  if (results.violations.length) throw new Error(results.violations.map((issue) => `${issue.id}: ${issue.help}`).join("\n"));
  console.log(`axe-core passed for ${target}`);
} finally { await browser.close(); }
