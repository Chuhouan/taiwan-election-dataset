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

test("legend explains scale, NA and bivariate cells highlight without filtering", async ({ page }) => {
  test.setTimeout(60000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#e=president&chart=map&detail=0&m=validVotes");
  await expect(page.locator("body")).not.toHaveClass(/loading/);
  await expect(page.locator(".legend-na")).toContainText("無資料");
  const ticks = await page.locator(".legend-ticks span").allTextContents();
  expect(ticks.length).toBe(3);
  expect(+ticks[1].replace(/[^\d.]/g, "")).toBeCloseTo(+ticks[2].replace(/[^\d.]/g, "") / 2, 1);
  await page.goto("/#e=president&chart=map&detail=0&m=bivariate");
  await expect(page.locator(".bivariate-cell")).toHaveCount(9);
  await page.locator('.bivariate-cell[data-bi="2-2"]').click();
  await expect(page.locator("#scope-summary")).toContainText("高亮");
  const before = await page.locator("#selection-bar").textContent();
  await page.locator('.bivariate-cell[data-bi="2-2"]').click();
  await expect(page.locator("#scope-summary")).not.toContainText("高亮");
  expect(await page.locator("#selection-bar").textContent()).toBe(before);
  await page.goto("/#e=president&chart=scatter&distribution=scatter&detail=0");
  await expect(page.locator(".scatter-dot").first()).toBeVisible();
  await page.locator(".scatter-dot").nth(5).click();
  await expect(page.locator(".scatter-dot.mark-selected")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("map modes switch purpose without resetting selection or camera", async ({ page }) => {
  test.setTimeout(60000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#e=president&chart=map&detail=0&selection=63000/010");
  await expect(page.locator(".map-modes button")).toHaveCount(5);
  await expect(page.locator('.map-modes button[data-map-mode="territory"]')).toHaveClass(/active/);
  const zoomBefore = await page.locator("#zoom-value").textContent();
  await page.locator('.map-modes button[data-map-mode="difference"]').click();
  await expect(page.locator('.map-modes button[data-map-mode="difference"]')).toHaveClass(/active/);
  await expect(page.locator("#metric-formula")).toContainText("A−B 差");
  await expect(page.locator("#selection-bar")).toContainText("1 地區");
  expect(await page.locator("#zoom-value").textContent()).toBe(zoomBefore);
  await page.locator('.map-modes button[data-map-mode="scale"]').click();
  await expect(page.locator("#metric-formula")).toContainText("有效票規模");
  await expect(page.locator("#selection-bar")).toContainText("1 地區");
  await page.locator("#metric-more").click();
  await expect(page.locator("#metric-popover #metric-mode")).toBeVisible();
  await expect(page.locator(".map-encoding-switch")).toBeVisible();
  expect(errors).toEqual([]);
});

test("metric definition popover, boundary badge and A/B strip are reachable", async ({ page }) => {
  test.setTimeout(60000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#e=president&chart=map&detail=0");
  await expect(page.locator("body")).not.toHaveClass(/loading/);
  await page.locator("#metric-info").click();
  await expect(page.locator("#metric-info-popover")).toContainText("分母");
  await expect(page.locator("#metric-info-popover")).toContainText("跨屆比較");
  await expect(page.locator("#boundary-badge")).toContainText("村里邊界");
  await page.goto("/#e=president&chart=map&detail=0&l=town&group-a=63000/010,63000/020&group-b=64000/010");
  await expect(page.locator("#ab-strip")).toBeVisible();
  await expect(page.locator("#ab-strip")).toContainText("A−B");
  await expect(page.locator("#ab-strip")).toContainText("有效票");
  expect(errors).toEqual([]);
});

test("nested condition groups combine with OR and restore from URL", async ({ page }) => {
  test.setTimeout(60000);
  const count = async (hash) => {
    await page.goto("/#" + hash);
    await expect(page.locator("body")).not.toHaveClass(/loading/);
    const text = await page.locator("#scope-summary .scope-statistics").textContent();
    return +text.match(/(\d+)／/)[1];
  };
  const orN = await count("e=president&chart=map&detail=0&f-share=45&f2-margin=3&f-inter=or");
  await expect(page.locator("#scope-summary .scope-dsl")).toContainText("∨");
  const aN = await count("e=president&chart=map&detail=0&f-share=45");
  const bN = await count("e=president&chart=map&detail=0&f2-margin=3");
  expect(orN).toBeGreaterThanOrEqual(Math.max(aN, bN));
  const andN = await count("e=president&chart=map&detail=0&f-share=45&f2-margin=3&f-inter=and");
  expect(andN).toBeLessThanOrEqual(Math.min(aN, bN));
  await page.goto("/#e=president&chart=map&detail=0&f-share=45&f2-margin=3&f-inter=or");
  await page.reload();
  await expect(page.locator("#scope-summary .scope-dsl")).toContainText("∨");
  expect(await page.locator("#scope-summary .scope-statistics").textContent()).toContain(orN + "／");
});

test("history defaults to change view when two years are requested", async ({ page }) => {
  test.setTimeout(60000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#e=president&history-a=2012&history-b=2024&history-county=63000");
  await expect(page.locator('[data-history-view="swipe"]')).toHaveClass(/active/);
  await page.locator('[data-history-view="matrix"]').click();
  await expect(page.locator('[data-history-view="matrix"]')).toHaveClass(/active/);
  await page.goto("/#e=president&history-region=matrix&history-a=2012&history-b=2024");
  await expect(page.locator('[data-history-view="matrix"]')).toHaveClass(/active/);
  expect(errors).toEqual([]);
});

test("command search reaches map modes and suggestions only change view", async ({ page }) => {
  test.setTimeout(60000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#e=president&chart=map&detail=0&selection=63000/010");
  await expect(page.locator("body")).not.toHaveClass(/loading/);
  await expect(page.locator("#view-suggestions")).toBeVisible();
  await page.locator("#view-suggestions .suggestion-chip").first().click();
  await expect(page.locator("#selection-bar")).toContainText("1 地區");
  await page.goto("/#e=president&chart=map&detail=0");
  await page.fill("#search", "差值");
  await page.locator("#search-results button", { hasText: "差值模式" }).first().click();
  await expect(page.locator("#metric-formula")).toContainText("A−B 差");
  await page.fill("#search", "歷史變化");
  await page.locator("#search-results button", { hasText: "歷史變化" }).first().click();
  await expect(page.locator('[data-history-view="swipe"]')).toHaveClass(/active/);
  expect(errors).toEqual([]);
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
