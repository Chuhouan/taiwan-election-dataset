import { test, expect } from "@playwright/test";
test.use({ channel: "chrome" });

test("inset frames size by geographic complexity and stay readable", async ({ page }) => {
  test.setTimeout(60000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#e=president&chart=map&detail=0");
  await expect(page.locator(".inset-frame")).toHaveCount(3);
  const boxes = await page.locator(".inset-frame").evaluateAll((els) =>
    els.map((el) => ({ w: +el.getAttribute("width"), h: +el.getAttribute("height") })),
  );
  for (const b of boxes) {
    expect(b.h).toBeGreaterThanOrEqual(64);
    expect(b.w).toBeGreaterThanOrEqual(120);
  }
  const areas = boxes.map((b) => b.w * b.h);
  expect(new Set(areas).size).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test("selection bar reports count, valid votes and weighted share", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/#e=president&chart=map&detail=0");
  await expect(page.locator("body")).not.toHaveClass(/loading/);
  await expect(page.locator("#selection-bar")).toContainText("368 地區 · 有效票");
  await expect(page.locator("#selection-bar")).toContainText("第一名加權");
  await page.goto("/#e=president&chart=map&detail=0&l=town&selection=63000/010");
  await expect(page.locator("#selection-bar")).toContainText("1 地區");
});

test("beeswarm draws quartile reference lines", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/#e=president&chart=scatter&distribution=swarm&detail=0");
  await expect(page.locator(".swarm-dot").first()).toBeVisible();
  await expect(page.locator(".swarm-quantile")).toHaveCount(3);
  const values = await page.locator(".swarm-quantile").evaluateAll((els) =>
    els.map((el) => +el.getAttribute("data-value")),
  );
  expect(values[0]).toBeLessThan(values[1]);
  expect(values[1]).toBeLessThan(values[2]);
  await expect(page.locator(".swarm-quantile-label").first()).toContainText("Q1");
});

test("disabled controls state their reason", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/#e=legislator&chart=map&detail=0");
  await expect(page.locator("body")).not.toHaveClass(/loading/);
  await expect(page.locator("#conditions-open")).toBeDisabled();
  expect(await page.locator("#conditions-open").getAttribute("title")).toContain("總統選舉");
  await expect(page.locator("#dual-view")).toBeDisabled();
  expect(await page.locator("#dual-view").getAttribute("title")).toContain("總統選舉");
  await expect(page.locator('button[data-chart="ternary"]')).toBeDisabled();
  expect(await page.locator('button[data-chart="ternary"]').getAttribute("title")).toContain("總統選舉");
  await page.goto("/#e=president&chart=map&detail=0");
  await expect(page.locator("#conditions-open")).toBeEnabled();
  expect(await page.locator("#conditions-open").getAttribute("title")).toBe("");
});

test("finding text links to the region it describes", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/#e=president&chart=map&detail=0");
  await expect(page.locator("body")).not.toHaveClass(/loading/);
  const link = page.locator("#finding .finding-link");
  await expect(link).toHaveCount(1);
  const name = await link.textContent();
  await link.click();
  await expect(page.locator("#breadcrumb")).toContainText(name.slice(0, 3));
});
