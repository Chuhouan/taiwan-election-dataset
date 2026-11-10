import { test, expect } from "@playwright/test";
import { Converter } from "opencc-js/t2cn";
import { readFileSync } from "node:fs";

test.use({ channel: "chrome" });

test("the county homepage has a lightweight data path and hands its selection to the workspace", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "賴清德當選總統" })).toBeVisible();
  await expect(page.locator(".home-deck")).toContainText("40.05%");
  await expect(page.locator("#map .county-geometries .geo[d]")).toHaveCount(22);
  expect(requests).not.toContain("/data.json");
  expect(requests).not.toContain("/towns-lod0.json");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024);
  await page.locator('#map .county-geometries .geo[data-key="10007/000"]').dispatchEvent("click");
  await expect(page.locator("#detail-title")).toHaveText("彰化縣");
  await expect(page.locator("#home-detail-explore")).toBeVisible();
  await expect(page.locator("#zoom-value")).toHaveText("1.0×");
  await page.locator("#home-detail-explore").click();
  await expect(page).toHaveURL(/\/explore\/.*r=10007%2F000/);
  await expect(page.locator("#detail-title")).toHaveText("彰化縣");
  await page.reload();
  await expect(page.locator("#detail-title")).toHaveText("彰化縣");
  await page.goBack();
  await expect(page.locator("#home-title")).toBeVisible();
  await page.locator("#home-detail-towns summary").click();
  await page.getByRole("button", { name: /^彰化市 · / }).click();
  await expect(page.locator("#detail-title")).toHaveText("彰化市");
  await expect(page.locator('.town-geometries:not([display="none"]) .geo[d]')).toHaveCount(368);
  await expect(page.locator("#zoom-value")).toHaveText("1.0×");
});

test("the generated national result is readable without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(baseURL);
    await expect(page.getByRole("heading", { name: "賴清德當選總統" })).toBeVisible();
    await expect(page.getByRole("table", { name: "全國候選人結果" })).toContainText("5,586,019");
    await expect(page.locator(".home-source")).toContainText("中央選舉委員會");
  } finally {
    await context.close();
  }
});

test("knowledge navigation, language, and night theme survive the normal entry points", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "夜間護眼" });
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await expect(page.locator("#map .county-geometries .geo[d]")).toHaveCount(22);
  await expect(page.locator("#chart-pane")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await page.locator(".home-how").hover();
  const card = page.locator(".knowledge-popover:popover-open");
  await expect(card.getByRole("heading")).toHaveText("第一名所屬政黨");
  await card.locator('[data-knowledge-next="share"]').click();
  await expect(card.getByRole("heading")).toHaveText("得票率");
  await page.keyboard.press("Escape");
  await expect(card.getByRole("heading")).toHaveText("第一名所屬政黨");
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await page.locator("#language-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  await expect(page.locator("#home-title")).toHaveText("赖清德当选总统");
  await page.goto("/about/");
  await expect(page.getByRole("heading", { name: "关于本网" })).toBeVisible();
  await expect(page.locator("#knowledge-index button")).toHaveCount(34);
  await page.locator("#knowledge-index-query").fill("莫名不存在的術語");
  await expect(page.locator("#knowledge-index-count")).toHaveText("找不到相符的术语");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await page.locator("#theme-toggle").click();
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "night");
});

test("query links keep filters and open the corresponding charts and historical records", async ({ page }) => {
  await page.goto("/explore/?mode=filter&f-candidate=柯文哲&f-share=30&f-turnout=70&f-margin=5");
  await expect(page.locator("#scope-summary")).toContainText("24／368");
  await expect(page.locator("#product-condition-status")).toContainText("1,896,160");
  await page.goto("/explore/?mode=filter&f-share=100");
  await expect(page.locator("#finding")).toContainText("沒有符合");
  await expect(page.locator("#national-scores")).toContainText("40.05");
  await page.goBack();
  await expect(page.locator("#scope-summary")).toContainText("24／368");
  await page.locator('[data-product-mode="chart"]').click();
  await expect(page.locator("#view-title")).toHaveText("三方競爭");
  await expect(page.locator("#scope-summary")).toContainText("24／368");
  await expect(page.locator("#metric-formula")).toContainText("100%");
  await page.goto("/explore/?mode=history&national-history=2024");
  await expect(page.locator("#history-dialog")).toBeVisible();
  await expect(page.locator("#history-detail")).toContainText("賴清德");
  await page.goto("/explore/?mode=history&e=legislator&chart=small");
  await expect(page.locator(".seat-dot")).toHaveCount(113);
  await expect(page.locator("#view-title")).toHaveText("完整國會 113 席");
});

test("homepage shows computed administrative groups and comparable national changes", async ({ page }) => {
  await page.goto("/");
  const places = page.locator("#home-place");
  await expect(places).toContainText("行政類型只作為城鄉代理");
  await expect(places.locator("tbody tr")).toHaveCount(4);
  await expect(places.locator("tbody tr").filter({ hasText: "投票率" })).toContainText("個百分點");
  const historical = page.locator("#home-change");
  await expect(historical.locator("tbody tr").filter({ hasText: "民主進步黨" }))
    .toContainText(/57\.13%.*40\.05%.*-17\.08/);
  await expect(historical.locator("tbody tr").filter({ hasText: "台灣民眾黨" }))
    .toContainText(/未提名.*26\.46%.*不可比/);
  await page.locator('[data-home-discover="history"]').click();
  await expect(page).toHaveURL(/#home-change$/);
  await historical.getByRole("link").click();
  await expect(page.locator("#county-history-dialog")).toBeVisible();
  await expect(page.locator("#county-history-a")).toHaveValue("2020");
});

test("advanced parameters and the data table share a dock without moving the map camera", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/explore/?mode=chart&chart=scatter&distribution=scatter&detail=0");
  await expect(page.locator("#view-title")).toHaveText("統計分布");
  await expect(page.locator("#axis-x")).toBeVisible();
  await page.locator("#workspace-options").click();
  await expect(page.locator("#explore-dock #axis-size")).toBeVisible();
  await page.locator("#axis-size").selectOption("fixed");
  await expect(page.locator("#metric-formula")).toContainText("點大小一致");
  await page.locator('#explore-dock [data-explore-panel="data"]').click();
  await expect(page.locator("#explore-table-scope")).toContainText("368");
  await expect(page.locator("#data-rows tr")).toHaveCount(368);
  const axes = await page.locator("#axes-control").boundingBox();
  const legend = await page.locator("#legend").boundingBox();
  expect(legend.y).toBeGreaterThanOrEqual(axes.y + axes.height);
  const axisTitle = await page.locator("#scatter .scatter-label").first().boundingBox();
  expect(legend.y + legend.height).toBeLessThanOrEqual(axisTitle.y);
  const selected = page.locator('[data-table-region="10007/010"] [data-show-map]');
  await selected.click();
  await expect(page.locator("#detail-title")).toHaveText("彰化市");
  await expect(page.locator("#zoom-value")).toHaveText("1.0×");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1024);
});

test("legends and SVG ticks have short readouts, and 30 live labels follow the language switch", async ({ page }) => {
  await page.goto("/explore/?mode=chart&chart=scatter&distribution=scatter");
  await expect(page.locator('.scatter-axis[data-axis="turnout"] .tick text').first()).toBeVisible();
  const tick = page.locator('.scatter-axis[data-axis="turnout"] .tick text').first();
  await tick.hover();
  await expect(page.locator("#atlas-short-readout:popover-open")).toContainText("投票率");
  await page.locator("#search").fill("臺北");
  await expect(page.locator(".search-category").first()).toBeVisible();
  const probes = [
    "title", ".brand b", "#product-main-link", "#language-toggle", "#theme-toggle",
    ...["map", "chart", "history", "filter"].map((mode) => `[data-product-mode="${mode}"]`),
    ".atlas-modes > a", "#election option:checked", "#copy-link", "#copy-summary",
    "#national-turnout", "#score-title", ".score-name", "#selection-bar", "#scope-summary",
    "#view-title", "#stage-metric", ".legend-title", ".legend-parties span", "#metric-formula",
    "#distribution-style option:checked", "#axis-x option:checked", "#axis-y option:checked",
    "#scatter .scatter-label", ".search-category", "#search-results button", "#workspace-options",
    "#workspace-data", "#list-toggle", "#detail-toggle",
  ];
  const read = () => page.evaluate((selectors) => selectors.map((selector) =>
    document.querySelector(selector)?.textContent.trim() || ""), probes);
  const convert = Converter({ from: "tw", to: "cn" });
  const before = await read();
  const changed = before.filter((text) => text && convert(text) !== text);
  expect(before.filter(Boolean).length).toBeGreaterThanOrEqual(30);
  expect(changed.length).toBeGreaterThan(15);
  const accessibleName = await page.locator("#search").getAttribute("aria-label");
  const xAxisValue = await page.locator("#axis-x").inputValue();
  await page.locator("#language-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  await expect(page.locator("#search")).toHaveAttribute("aria-label", convert(accessibleName));
  const after = await read();
  for (const [index, value] of before.entries()) {
    if (!value || probes[index] === "#language-toggle" || probes[index].startsWith(".search-category") || probes[index].startsWith("#search-results"))
      continue;
    expect(after[index], probes[index]).toBe(convert(value));
  }
  await expect(page.locator("#axis-x")).toHaveValue(xAxisValue);
  await page.locator("#axis-x").selectOption("votes");
  await expect(page.locator("#metric-formula")).toContainText("横轴：有效票");
  await page.locator("#search").fill("台北");
  await expect(page.locator("#search-results")).toContainText("台北市");
});

test("large analysis links retain every region and use a short server request", async ({ page }) => {
  const { president } = JSON.parse(readFileSync("dist/data.json", "utf8"));
  const keys = Object.keys(president).filter((key) => !key.endsWith("/000"));
  const selection = keys.join(",");
  const groups = { "group-a": keys.slice(0, 184).join(","), "group-b": keys.slice(184).join(",") };
  const state = { selection, ...groups, "f-base": selection, "f-mode": "highlight", "f-share": "30" };
  const fragment = new URLSearchParams({ chart: "ternary", ...state });
  await page.goto("/explore/?mode=chart#" + fragment);
  await expect(page.locator("#view-title")).toHaveText("三方競爭");
  const saved = new URL(page.url());
  expect(saved.search).toBe("?mode=chart");
  const roundTrip = new URLSearchParams(saved.hash.slice(1));
  for (const [key, value] of Object.entries(state)) expect(roundTrip.get(key)).toBe(value);
  await page.reload();
  await expect(page.locator("#scope-summary")).toContainText("368／368");
  expect(new URL(page.url()).hash).toBe(saved.hash);
});
