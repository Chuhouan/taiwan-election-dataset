import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test.use({ channel: "chrome" });
test("local spatial method exposes its full reproducible settings", async ({ page }) => {
  test.setTimeout(60000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#e=president&chart=map"); await expect(page.locator("body")).not.toHaveClass(/loading/);
  await page.locator(".research-menu summary").click(); await page.locator("#spatial-open").click();
  await expect(page.locator(".spatial-dot").first()).toBeVisible();
  await page.locator('[data-spatial-view="local"]').click();
  await expect(page.locator("#local-summary")).toContainText("seed=2024");
  await expect(page.locator("#local-summary")).toContainText("BY q≤0.05");
  expect(await page.locator("#local-result-table tbody tr").count()).toBe(356);
  await page.locator("#local-permutations").selectOption("99");
  await expect(page.locator("#local-summary")).toContainText(" · 99 次排列");
  await page.screenshot({ path: "docs/screenshots/sol-local-moran.png" });
  expect(errors).toEqual([]);
});
test("historical arrows include islands and reference raw comparable differences", async ({ page }) => {
  test.setTimeout(60000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#e=president&history-region=maps&history-a=2008&history-b=2024&history-county=66000");
  await page.locator("#history-arrows").check();
  await expect(page.locator(".history-swing-arrow path")).toHaveCount(22);
  for (const code of ["09007", "09020", "10016"]) {
    const arrow = page.locator(`.history-swing-arrow[data-county="${code}"]`);
    await expect(arrow.locator("path")).toBeVisible();
    expect(await arrow.getAttribute("transform")).not.toContain("NaN");
  }
  await page.locator('[data-history-view="trend"]').click();
  await expect(page.locator(".history-boundary-change")).toHaveCount(1);
  await page.screenshot({ path: "docs/screenshots/sol-history-boundary.png" });
  expect(errors).toEqual([]);
});
test("village context keeps three raw-vote scales and exposes boundary evidence", async ({ page }) => {
  test.setTimeout(60000);
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#e=president&village-county=63000&village-town=010&village-id=63000/010/0002");
  await expect(page.locator(".village-context")).toContainText("三個尺度");
  await expect(page.locator(".village-context tbody tr")).toHaveCount(4);
  await page.locator(".village-evidence summary").click();
  await expect(page.locator(".village-evidence")).toContainText("1120928");
  await page.screenshot({ path: "docs/screenshots/sol-village-context.png" });
  expect(errors).toEqual([]);
});
test("source evidence is queryable without replacing the analysis", async ({ page }) => {
  await page.goto("/#e=president&chart=ternary&detail=0"); await expect(page.locator("body")).not.toHaveClass(/loading/);
  await page.locator("#source-badge").click();
  await expect(page.locator("#evidence-detail")).toContainText("檔案 SHA-256");
  await page.locator("#evidence-search").fill("president:1996:county");
  await expect(page.locator("#evidence-dataset option")).toHaveCount(1);
  await expect(page.locator("#evidence-detail")).toContainText("整縣市無損聚合");
  await page.locator("#evidence-close").click();
  await expect(page.locator("#scope-summary")).toContainText("368／368");
});
test("multiscale vote-weighted quartiles match raw county vote totals", async ({ page }) => {
  test.setTimeout(60000);
  const data = JSON.parse(await readFile("dist/data.json", "utf8")),
    rows = Object.values(data.president).filter((r) => data.counties[r.county] && r.town === "000")
      .map((r) => ({ value: 100 * r.candidates.find((c) => c.name === "賴清德").votes / r.total, weight: r.total })).sort((a, b) => a.value - b.value),
    total = rows.reduce((s, r) => s + r.weight, 0), expected = [.25, .75].map((p) => { let sum = 0; return rows.find((r) => (sum += r.weight) >= p * total).value; });
  await page.goto("/#e=president&scale-county=63000&scale-town=010&scale-weight=votes");
  await expect(page.locator("#scale-chart")).toHaveAttribute("data-ready", "true");
  const iqr = page.locator('.scale-iqr[data-level="county"]');
  expect(+(await iqr.getAttribute("data-q1"))).toBeCloseTo(expected[0], 10);
  expect(+(await iqr.getAttribute("data-q3"))).toBeCloseTo(expected[1], 10);
  await page.reload(); await expect(page.locator("#scale-weight")).toHaveValue("votes");
});
