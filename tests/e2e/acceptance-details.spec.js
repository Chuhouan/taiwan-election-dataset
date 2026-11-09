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

test("scope details distinguish local winners' vote share from the national result", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/#e=president&chart=map&detail=0");
  await expect(page.locator("body")).not.toHaveClass(/loading/);
  await expect(page.locator("#scope-summary")).toContainText("分析範圍 368／368");
  await expect(page.locator("#selection-bar")).toHaveText("有效票 13,947,506");
  await expect(page.locator("#score-title")).toContainText("全國");
  await expect(page.locator("#national-scores")).toContainText("40.05");
  await expect(page.locator("#range-lead-share")).toBeHidden();
  await page.locator("#analysis-state-more summary").click();
  await expect(page.locator("#range-readout")).toContainText("各地第一名票數合計占有效票");
  await expect(page.locator("#range-lead-share")).toHaveText("42.73%");
  await expect(page.locator("#range-lead-method")).toContainText("有效票合計（13,947,506 票）");
  await page.goto("/#e=president&chart=map&detail=0&l=town&selection=63000/010");
  await expect(page.locator("#selection-bar")).toContainText("1 地區");
  await page.goto("/#e=president&chart=map&detail=0&f-share=100");
  await expect(page.locator("#range-lead-share")).toHaveText("—");
});

test("captions follow the active view and ternary modes report their visible population", async ({ page }) => {
  await page.goto("/#e=president&chart=map&detail=0&m=turnout");
  const caption = page.locator("#metric-formula");
  await expect(caption).toContainText("投票率＝投票數");
  await page.locator('[data-chart="ternary"]').click();
  await expect(caption).toContainText("有效票占比合計 100%");
  await expect(page.locator("#metric-info")).toBeHidden();
  const focus = page.locator('[data-ternary-view="focus"]');
  const full = page.locator('[data-ternary-view="full"]');
  await expect(focus).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#ternary-view-count")).toContainText("/ 368 地區");
  await full.click();
  await expect(full).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#ternary-view-count")).toHaveText("顯示全部 368 地區");
  await page.locator('[data-chart="bubble"]').click();
  await expect(caption).toContainText("圓面積代表有效票");
  await page.locator('[data-chart="scatter"]').click();
  await expect(caption).toContainText("個百分點");
  await page.locator("#distribution-style").selectOption("scatter");
  await expect(caption).toContainText("橫軸：投票率（%）");
  await page.locator("#axis-x").selectOption("share");
  await expect(caption).toContainText("橫軸：賴清德得票率（%）");
  await page.locator('[data-chart="map"]').click();
  await expect(caption).toContainText("投票率＝投票數");
  await page.goto("/#e=president&chart=ternary&dual=1&detail=0&m=turnout");
  await expect(page.locator("#left-pane-caption")).toContainText("投票率＝投票數");
  await expect(page.locator("#right-pane-caption")).toContainText("占比合計 100%");
  await page.locator('[data-ternary-mode="hexbin"]').click();
  await expect(page.locator("#right-pane-caption")).toContainText("分箱：地區等權");
  await expect(page.locator("#left-pane-caption")).toContainText("投票率＝投票數");
});

test("history matrix keeps its headings and reads the clicked county-year after scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto("/#e=president&history-region=matrix&history-metric=dpp&history-county=63000");
  const plot = page.locator(".county-history-plot");
  const years = page.locator(".history-matrix-years");
  const counties = page.locator(".history-matrix-counties");
  await expect(years).toBeVisible();
  const yearY = (await years.boundingBox()).y;
  const countyX = (await counties.boundingBox()).x;
  const scroll = await plot.evaluate((el) => {
    el.scrollTo(el.scrollWidth, el.scrollHeight);
    return [el.scrollLeft, el.scrollTop];
  });
  expect(scroll[1]).toBeGreaterThan(0);
  await expect.poll(async () => (await years.boundingBox()).y).toBeCloseTo(yearY, 0);
  await expect.poll(async () => (await counties.boundingBox()).x).toBeCloseTo(countyX, 0);
  const cell = page.locator('.history-matrix-cell[data-county="09007"][data-year="2024"]');
  const value = Number(await cell.getAttribute("data-value"));
  await cell.click();
  const readout = page.locator("#county-history-readout");
  await expect(readout).toContainText("連江縣");
  await expect(readout).toContainText("2024");
  await expect(readout).toContainText(value.toFixed(2) + "%");
  await expect(readout.locator(".history-sparkline")).toBeHidden();
  await readout.locator("summary").click();
  await expect(readout.locator(".history-sparkline")).toBeVisible();
  await page.locator("#county-history-sort").selectOption("volatility");
  await expect(cell).toHaveAttribute("data-value", String(value));
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
  await expect(page.locator("#stage-metric")).toContainText("得票率差");
  await expect(page.locator("#candidate-filter")).toBeHidden();
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
  await page.locator("#analysis-state-more summary").click();
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

test("default desktop map reserves at least 72% of the central workspace", async ({ page }) => {
  await page.goto("/#e=president&chart=map&detail=0");
  const workspace = page.locator(".map-workspace");
  await expect(workspace).toHaveAttribute("data-layout-ready", "true");
  const result = await workspace.evaluate((el) => {
    const box = (selector) => el.querySelector(selector).getBoundingClientRect();
    const workspace = el.getBoundingClientRect();
    const map = box("#map");
    const top = Math.max(map.top, box(".map-toolbar").bottom, box(".workspace-heading").bottom);
    const bottom = Math.min(map.bottom, box("#finding").top, box(".map-bottom").top);
    return {
      ratio: (map.width * Math.max(0, bottom - top)) / (workspace.width * workspace.height),
      scrollable: document.documentElement.scrollHeight > innerHeight,
      controlsEnd: box(".map-toolbar").bottom,
      mapStart: map.top,
    };
  });
  expect(result.ratio).toBeGreaterThanOrEqual(0.72);
  expect(result.scrollable).toBe(true);
  expect(result.controlsEnd).toBeLessThanOrEqual(result.mapStart + 1);
  await page.locator('button[data-chart="ternary"]').click();
  await expect(page.locator(".map-modes")).toBeHidden();
  await page.locator('button[data-chart="map"]').click();
  await page.locator('[data-map-mode="difference"]').click();
  await expect(page.locator("#metric-formula")).toContainText("A−B 差");
});

test("linked hover preserves A/B marks and condition emphasis across map and chart", async ({ page }) => {
  const a = "67000/210", b = "64000/270";
  await page.goto(`/#e=president&chart=ternary&ternary-focus=0&dual=1&detail=0&group-a=${a}&group-b=${b}&f-candidate=賴清德&f-share=52&f-mode=highlight`);
  const map = (key) => page.locator(`#map .town-geometries .geo[data-key="${key}"]`);
  const dot = (key) => page.locator(`#scatter .ternary-dot[data-region-key="${key}"]`);
  await expect(map(a)).toHaveClass(/\bcondition-highlight\b/);
  await expect(map(b)).toHaveClass(/\bcondition-muted\b/);
  await expect(page.locator(`[data-group-region="${a}"]`)).toHaveText("A");
  await expect(page.locator(`[data-group-region="${b}"]`)).toHaveText("B");
  const summary = await page.locator(".analysis-state").boundingBox();
  const heading = await page.locator(".workspace-heading").boundingBox();
  expect(summary.y + summary.height).toBeLessThanOrEqual(heading.y);
  await expect(map(a)).toHaveCSS("stroke-width", "0.7px");
  await expect(page.locator("#map .town-geometries .geo.condition-highlight:not(.group-a):not(.group-b)").first()).toHaveCSS("stroke-width", "0.7px");
  await expect(map(b)).toHaveCSS("opacity", "0.3");
  await expect(dot(b)).toHaveCSS("opacity", "0.3");
  const original = await dot(a).evaluate((el) => {
    const style = getComputedStyle(el);
    return { stroke: style.stroke, width: parseFloat(style.strokeWidth) };
  });
  expect(original.stroke).toBe("rgb(213, 146, 36)");
  const hit = await map(a).evaluate((el) => {
    const r = el.getBoundingClientRect();
    for (let y = r.top + 2; y < r.bottom; y += 2)
      for (let x = r.left + 2; x < r.right; x += 2)
        if (document.elementFromPoint(x, y) === el) return { x, y };
    return null;
  });
  expect(hit).toBeTruthy();
  await page.mouse.move(hit.x, hit.y);
  await expect(map(a)).toHaveClass(/\blinked-region\b/);
  await expect(map(a)).toHaveCSS("outline-style", "none");
  await expect(map(a)).toHaveCSS("filter", /saturate\(1.3\).*brightness\(1.16\)/);
  await expect(dot(a)).toHaveClass(/\blinked-region\b/);
  await expect(dot(a)).toHaveCSS("stroke", original.stroke);
  await expect(dot(a)).toHaveCSS("filter", /brightness.*drop-shadow/);
  expect(await dot(a).evaluate((el) => parseFloat(getComputedStyle(el).strokeWidth))).toBeGreaterThan(original.width);
  await page.mouse.move(4, 4);
  await expect(dot(a)).not.toHaveClass(/\blinked-region\b/);
  await expect(dot(a)).toHaveClass(/\bgroup-a\b/);
  await expect(dot(a)).toHaveClass(/\bcondition-highlight\b/);
  await expect(dot(a)).toHaveCSS("stroke", original.stroke);
  await expect(map(a)).toHaveCSS("filter", /saturate\(1.3\).*brightness\(1\)/);
});

test("analysis state controls clear only their own layer", async ({ page }) => {
  await page.goto("/#e=president&chart=map&detail=0&r=63000/010&inspect=1&group-a=63000/010&group-b=63000/020&f-mode=highlight&f2-turnout=70&f-base=63000/010,63000/020");
  const state = page.locator(".analysis-state");
  await expect(state.locator(".scope-pin")).toContainText("松山區");
  await expect(state.locator("#selection-bar")).toContainText("2 地區");
  await state.locator(".scope-pin").click();
  await expect(state.locator(".scope-pin")).toHaveCount(0);
  await expect(state.locator(".scope-highlight")).toBeVisible();
  await expect(state.locator(".scope-group-a")).toBeVisible();
  await state.locator(".scope-group-a").click();
  await expect(state.locator(".scope-group-a")).toHaveCount(0);
  await expect(state.locator(".scope-group-b")).toBeVisible();
  await expect(state.locator(".scope-highlight")).toBeVisible();
  await state.locator(".scope-highlight").click();
  await expect(state.locator(".scope-highlight")).toHaveCount(0);
  await expect(state.locator(".scope-dsl")).toHaveCount(0);
  await expect(state.locator("#selection-bar")).toContainText("2 地區");
  await expect(state.locator(".scope-group-b")).toBeVisible();
});

test("region inspector keeps the summary visible while switching sections", async ({ page }) => {
  await page.goto("/#e=president&chart=map&l=county&r=66000/000&inspect=1&detail=1");
  await expect(page.locator("#detail-title")).toHaveText("臺中市");
  await expect(page.locator("#inspector-winner")).toHaveText("賴清德");
  await expect(page.locator("#inspector-share")).toHaveText("37.58%");
  await expect(page.locator("#detail-stats")).toContainText("1,707,203");
  await page.locator('[data-inspector-tab="compare"]').click();
  await expect(page.locator("#detail-chart .margin-callout")).toBeVisible();
  await expect(page.locator("#inspector-lead")).toBeVisible();
  await expect(page.locator("#detail-result")).toBeHidden();
  await page.locator('[data-inspector-tab="structure"]').click();
  await page.locator("#inspector-structure summary").click();
  await expect(page.locator("#detail-note")).toContainText("中選會");
  await page.locator('[data-inspector-tab="result"]').click();
  await expect(page.locator("#detail-result .result-candidate")).toHaveCount(3);
  await expect(page.locator("#inspector-share")).toHaveText("37.58%");
});

test("view switcher and contextual settings preserve the displayed selection", async ({ page }) => {
  await page.goto("/#e=president&chart=map&selection=63000/010&detail=0");
  const tabs = page.locator(".view-switch");
  await expect(tabs).toHaveCount(6);
  await expect(tabs.locator("svg")).toHaveCount(6);
  await page.locator('[data-chart="hex"]').click();
  await expect(tabs.filter({ hasText: "等權格網" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#hex-labels")).toBeHidden();
  await page.locator("#chart-options .stage-settings summary").click();
  await page.locator("#hex-labels").selectOption("detail");
  await page.locator("#chart-options .stage-settings summary").click();
  await expect(page.locator("#hex-labels")).toHaveValue("detail");
  await expect(page.locator("#selection-bar")).toContainText("1 地區");
});
