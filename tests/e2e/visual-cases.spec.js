import { test, expect } from "@playwright/test";
import { normalCases, edgeCases } from "../fixtures/visual-cases.js";
test.use({ channel: "chrome" });
async function inspect(page, item) {
  if (item.name.startsWith("parliament-")) await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#" + item.hash); await expect(page.locator("body")).not.toHaveClass(/loading/);
  if (item.name === "history") await expect(page.locator(".history-matrix-cell").first()).toBeVisible();
  else if (item.name === "parliament") await expect(page.locator(".seat-dot").first()).toBeVisible();
  else if (item.name.startsWith("parliament-")) await expect(page.locator("#parliament-history-chart")).toHaveAttribute("data-ready", "true");
  else if (item.chart === "bubble" || item.name === "bubble") {
    if (item.state !== "empty") await expect(page.locator(".unit").first()).toBeVisible();
  }
  if (item.state === "empty") await expect(page.locator("#finding")).toContainText("沒有符合");
  const audit = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    invalidGeometry: [...document.querySelectorAll("svg path[d]")].some((el) => /NaN|Infinity/.test(el.getAttribute("d"))),
  }));
  expect(audit).toEqual({ overflow: false, invalidGeometry: false });
  expect(errors).toEqual([]);
}
for (const width of [1280, 1440, 1920]) for (const item of normalCases) {
  test(`${item.name} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); await inspect(page, item);
    await expect(page).toHaveScreenshot(`sol-${item.name}-${width}.png`, { animations: "disabled" });
  });
}
for (const item of edgeCases) test(item.name, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await inspect(page, item);
  await expect(page).toHaveScreenshot(`sol-${item.name}.png`, { animations: "disabled" });
});
