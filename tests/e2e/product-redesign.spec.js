import { test, expect } from "@playwright/test";

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
