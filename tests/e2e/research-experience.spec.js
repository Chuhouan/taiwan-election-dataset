import { test, expect } from "@playwright/test";
test.use({ channel: "chrome" });
async function ready(page, hash = "e=president&chart=ternary&dual=1&detail=0") {
  await page.goto("/#" + hash); await expect(page.locator("body")).not.toHaveClass(/loading/);
}
const cases = ["chart=bad", "e=bad", "m=bad", "l=bad", "camera=2,NaN,0", "camera=0,0,0", "ternary-camera=77,0,0", "split=100", "dual=bad", "candidate=nope", "f-share=999", "f-turnout=-1", "f-margin=nope", "f-mode=bad", "group-a=nope", "group-b=bad", "selection=bad", "r=bad", "c=bad", "axis-x=bad", "axis-y=bad", "density-mode=bad", "point-size=bad", "e=legislator&chart=ternary&m=share&dual=1", "chart=ternary&l=town", "chart=hex", "chart=bubble", "chart=scatter&distribution=ecdf", "e=legislator&chart=small&seats=regional", "e=legislator&chart=small&seat-focus=不分區"];
test("thirty valid and invalid deep links render without page errors", async ({ page }) => {
  test.setTimeout(120000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  for (const hash of cases) { await ready(page, hash); await expect(page.locator("#scope-summary")).not.toBeEmpty(); }
  expect(errors).toEqual([]);
});
test("county context, group names and focus preserve the population and route", async ({ page }) => {
  test.setTimeout(60000);
  await ready(page);
  await page.locator("#county-context").selectOption("63000");
  await expect(page.locator("#scope-summary")).toContainText("368／368");
  await expect(page.locator(".ternary-dot")).toHaveCount(368);
  await expect(page.locator(".ternary-dot.county-context-active")).toHaveCount(12);
  await expect(page.locator("#county-context-summary")).toContainText("38.13%");
  await page.locator("#county-context-summary button").first().click();
  await page.locator(".research-menu summary").click(); await page.locator("#groups-open").click();
  await page.locator("#group-name-a").fill("臺北十二區"); await page.locator("#group-name-a").dispatchEvent("change");
  await expect(page.locator("#scope-summary")).toContainText("臺北十二區 12");
  await page.locator("#groups-close").click(); await page.locator("#focus-mode").click();
  await expect(page.locator("body")).toHaveClass(/focus-mode/);
  await expect(page.locator(".ternary-dot")).toHaveCount(368);
  await page.reload(); await expect(page.locator("body")).toHaveClass(/focus-mode/);
  await expect(page.locator("#scope-summary")).toContainText("臺北十二區 12");
  await page.locator("#focus-mode").click();
  await expect(page.locator("#county-context")).toHaveValue("63000");
});
test("search finds regions, candidates and functions", async ({ page }) => {
  await ready(page);
  for (const [query, text] of [["竹南", "竹南鎮"], ["柯文哲", "候選人"], ["票源", "票源與貢獻"]]) {
    await page.locator("#search").fill(query); await expect(page.locator("#search-results")).toContainText(text);
  }
  await ready(page, "e=legislator&chart=hex"); await page.locator("#search").fill("台北1"); await expect(page.locator("#search-results")).toContainText("第1選區");
});
test("named views restore in a fresh page and can be removed", async ({ page, context }) => {
  await ready(page); await page.locator("#county-context").selectOption("10004");
  await page.locator(".research-menu summary").click(); await page.locator("#saved-views-open").click();
  await page.locator("#saved-view-name").fill("新竹三方對照"); await page.locator("#save-view-form button").click();
  const other = await context.newPage(); await ready(other, "e=president&chart=map");
  await other.locator(".research-menu summary").click(); await other.locator("#saved-views-open").click();
  await other.locator("#saved-view-list .saved-view-row > button").first().click();
  await expect(other.locator("#county-context")).toHaveValue("10004");
  await expect(other.locator("#scope-summary")).toContainText("368／368");
  await other.locator(".research-menu summary").click(); await other.locator("#saved-views-open").click();
  await other.locator("#saved-view-list .saved-view-row button").filter({ hasText: "刪除" }).click();
  await expect(other.locator("#saved-view-list")).toContainText("尚未收藏");
  await expect(page.locator("#saved-view-list")).toContainText("尚未收藏");
  await other.close();
});
test("map proportional symbols encode true vote areas and mode changes retain inspection", async ({ page }) => {
  await ready(page, "e=president&chart=map&l=county&inspect=1&r=63000/000&detail=0");
  await page.locator('[data-map-encoding="symbols"]').click();
  await expect(page.locator(".vote-symbol")).toHaveCount(22);
  const result = await page.locator(".vote-symbol").evaluateAll((nodes) => {
    const [a, b] = nodes.slice(0, 2); return { area: a.r.baseVal.value ** 2 / b.r.baseVal.value ** 2, votes: a.__data__.r.total / b.__data__.r.total };
  });
  // SVGAnimatedLength exposes float32 values; compare relative area within 1 ppm.
  expect(Math.abs(result.area / result.votes - 1)).toBeLessThan(.000001);
  await page.locator('[data-map-encoding="margin"]').click();
  expect(new URLSearchParams(new URL(page.url()).hash.slice(1)).get("r")).toBe("63000/000");
});
test("browser back and forward restore chart and county context", async ({ page }) => {
  test.setTimeout(60000);
  await ready(page); await page.locator("#county-context").selectOption("63000");
  await page.waitForTimeout(100); await page.locator("#pane-chart-type").selectOption("scatter"); await page.waitForTimeout(100);
  await page.goBack(); await expect(page.locator("#pane-chart-type")).toHaveValue("ternary");
  await expect(page.locator("#county-context")).toHaveValue("63000");
  await page.goForward(); await expect(page.locator("#pane-chart-type")).toHaveValue("scatter");
});
test("alternative party symbols remain selectable without changing population", async ({ page }) => {
  await ready(page, "e=president&chart=ternary&detail=0&ternary-focus=0&color-mode=accessible");
  await expect(page.locator('.accessible-symbol[data-party-symbol="triangle"]').first()).toBeVisible();
  const key = await page.locator('.accessible-symbol').evaluateAll((nodes) => {
    const node = nodes.find((n) => { const r = n.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === n; });
    return node?.dataset.regionKey;
  });
  expect(key).toBeTruthy();
  const mark = page.locator(`.accessible-symbol[data-region-key="${key}"]`);
  await mark.click();
  expect(new URLSearchParams(new URL(page.url()).hash.slice(1)).get("r")).toBe(key);
  await expect(page.locator("#scope-summary")).toContainText("368／368");
  await expect(page.locator(".party-symbol-key")).toContainText("相同圖形面積");
});
