import { test, expect } from "@playwright/test";
test("axe AA and keyboard regions", async ({ page }) => {
  await page.goto("/?qa=release");
  await page.locator("#qa-audit").click();
  await expect(page.locator("#qa-audit")).toBeEnabled({ timeout: 30000 });
  const report = JSON.parse(await page.locator("#qa-report").textContent());
  expect(report.audits.at(-1).violations).toEqual([]);
  const target = page.locator('#map [role="button"][tabindex="0"]');
  await target.press("ArrowRight");
  await expect(
    page.locator('#map [role="button"][tabindex="0"]'),
  ).toBeFocused();
  await page.locator('#map [role="button"][tabindex="0"]').press("Enter");
  await expect(page.locator("#analysis-status")).not.toHaveText("");
});
