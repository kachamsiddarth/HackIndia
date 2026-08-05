import axe from "axe-core";
import { chromium } from "playwright";

try {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<main><img src="/avatar.png"><button></button></main>');
    await page.addScriptTag({ content: axe.source });
    const ids = await page.evaluate(async () => {
      const result = await axe.run(document, {
        runOnly: { type: "rule", values: ["image-alt", "button-name"] },
      });
      return result.violations.map((violation) => violation.id);
    });
    if (!ids.includes("image-alt") || !ids.includes("button-name")) {
      throw new Error(`Unexpected axe-core results: ${ids.join(", ")}`);
    }
    console.log(`axe-core browser audit passed: ${ids.join(", ")}`);
  } finally {
    await browser.close();
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
