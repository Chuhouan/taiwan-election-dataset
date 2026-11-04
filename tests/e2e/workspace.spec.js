import { test, expect } from "@playwright/test";
test("primary views, shared selection and independent dual zoom", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("aria-busy", "false");
  for (const chart of ["map", "hex", "bubble", "ternary", "small", "scatter"]) {
    await page.locator(`button[data-chart="${chart}"]`).click();
    await expect(page.locator("body")).toHaveAttribute("data-chart", chart);
  }
  await page.locator('button[data-chart="ternary"]').click();
  await page.locator("#research-summary").click();
  await page.locator("#dual-view").click();
  const points = () =>
    page
      .locator(".ternary-dot")
      .evaluateAll((nodes) =>
        nodes.map((n) => [n.getAttribute("cx"), n.getAttribute("cy")]),
      );
  const before = await points();
  await page.locator("#zoom-in").click();
  expect(await points()).toEqual(before);
  await page.locator("#dual-map-focus").click();
  await expect(page.locator("body")).toHaveClass(/dual-map-focus/);
  await page.locator("#dual-map-focus").click();
  await page.locator("#dual-chart-focus").click();
  await expect(page.locator("body")).toHaveClass(/dual-chart-focus/);
  expect(errors).toEqual([]);
});
test("deep link restores full reproducible route", async ({ page }) => {
  await page.goto(
    "/#e=president&m=share&l=town&chart=ternary&c=63000&r=63000%2F010&candidate=柯文哲&ternary-focus=1",
  );
  await expect(page.locator("#detail-title")).toHaveText("松山區");
  const hash = new URL(page.url()).hash;
  await page.reload();
  await expect(page.locator("#detail-title")).toHaveText("松山區");
  expect(new URL(page.url()).hash).toBe(hash);
});
test("publication downloads current analysis as SVG", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("aria-busy", "false");
  const download = page.waitForEvent("download");
  await page.locator("#image-export").selectOption("svg");
  expect((await download).suggestedFilename()).toMatch(/\.svg$/);
});
for (const [width, height] of [
  [1280, 800],
  [1440, 900],
  [1920, 1080],
])
  test(`desktop map ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.locator(".map-workspace")).toHaveAttribute(
      "data-layout-ready",
      "true",
    );
    await expect(page).toHaveScreenshot(`map-${width}.png`, {
      animations: "disabled",
    });
  });
