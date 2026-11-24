import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto("http://127.0.0.1:3000");
await page.waitForTimeout(2000);

const issues = await page.evaluate(() => {
  const portal = document.querySelector("nextjs-portal");
  if (!portal || !portal.shadowRoot) return [];
  // find all elements with text or error
  return Array.from(portal.shadowRoot.querySelectorAll("*"))
    .map(el => el.innerText || el.textContent)
    .filter(t => t && t.length > 3 && t.length < 200);
});

console.log("Console/page errors:", errors);
console.log("Portal texts:", issues);
await browser.close();
