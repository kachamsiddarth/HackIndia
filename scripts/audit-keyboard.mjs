import { chromium } from "playwright";

const target = process.argv[2] ?? "http://127.0.0.1:3000/";
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  const page = await browser.newPage();
  await page.goto(target, { waitUntil: "networkidle" });
  const audit = await page.evaluate(() => {
    const main = document.querySelector("main");
    const focusable = [...document.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")];
    return {
      hasMainLandmark: Boolean(main),
      hasSingleH1: document.querySelectorAll("h1").length === 1,
      focusableWithoutName: focusable.filter((element) => !element.getAttribute("aria-label") && !element.textContent?.trim() && !element.querySelector("img[alt]")).length,
    };
  });

  if (!audit.hasMainLandmark || !audit.hasSingleH1 || audit.focusableWithoutName > 0) {
    throw new Error(`Keyboard/semantic audit failed: ${JSON.stringify(audit)}`);
  }
  console.log(`Keyboard and semantic audit passed for ${target}`);
} finally {
  await browser.close();
}
