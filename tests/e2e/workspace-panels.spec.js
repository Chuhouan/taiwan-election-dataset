import { test, expect } from "@playwright/test";

test.use({ channel: "chrome" });

async function ready(page, hash) {
  await page.goto("/#e=president&detail=0&" + hash);
  await expect(page.locator("body")).not.toHaveClass(/loading/);
  await expect(page.locator("#scope-summary")).toContainText("368／368");
  await page.waitForTimeout(150);
}

for (const width of [1280, 1440, 1920]) {
  for (const split of [40, 50, 60]) {
    test(`independent panels ${width}px ${split}:${100 - split}`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: 1000 });
      await ready(page, `chart=ternary&dual=1&split=${split}`);
      const bounds = await page.evaluate(() => {
        const rect = (id) => {
          const r = document.querySelector(id).getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        };
        return { left: rect("#left-pane-head"), right: rect("#right-pane-head"), map: rect("#map-host"), pane: rect("#chart-pane"), tools: rect("#chart-options") };
      });
      expect(bounds.left.right).toBeLessThanOrEqual(bounds.right.left);
      expect(bounds.tools.left).toBeGreaterThanOrEqual(bounds.pane.left);
      expect(bounds.tools.right).toBeLessThanOrEqual(bounds.pane.right);
      expect(bounds.tools.bottom).toBeLessThanOrEqual(bounds.right.bottom);
      const camera = new URLSearchParams(new URL(page.url()).hash.slice(1)).get("camera");
      await page.locator('[data-ternary-nav="in"]').click();
      expect(new URLSearchParams(new URL(page.url()).hash.slice(1)).get("camera")).toBe(camera);
      await page.locator("#dual-chart-focus").click();
      await expect(page.locator("body")).toHaveClass(/dual-chart-focus/);
      await page.locator("#dual-chart-focus").click();
      await expect(page.locator("body")).not.toHaveClass(/dual-chart-focus/);
      expect(new URLSearchParams(new URL(page.url()).hash.slice(1)).get("camera")).toBe(camera);
      await page.locator('[data-ternary-nav="reset"]').click();
      await page.screenshot({ path: `docs/screenshots/sol-panels-${width}-${split}.png` });
      expect(errors).toEqual([]);
    });
  }
}

test("all statistical view controls dock and restore", async ({ page }) => {
  await ready(page, "chart=ternary&dual=1");
  await expect(page.locator("#dual-split")).toHaveValue("60");
  for (const [chart, id] of [["hex", "chart-options"], ["bubble", "chart-options"], ["small", "relative-control"], ["scatter", "distribution-filter"]]) {
    await page.locator("#pane-chart-type").selectOption(chart);
    await expect(page.locator(`#right-pane-controls #${id}`)).toBeVisible();
    const labelBounds = await page.locator("#labels-toggle").boundingBox(),
      headBounds = await page.locator("#left-pane-head").boundingBox();
    if (labelBounds) {
      expect(labelBounds.y).toBeGreaterThanOrEqual(headBounds.y);
      expect(labelBounds.y + labelBounds.height).toBeLessThanOrEqual(headBounds.y + headBounds.height);
    }
  }
  await page.locator(".research-menu summary").click();
  await page.locator("#dual-view").click();
  await expect(page.locator("body")).not.toHaveClass(/dual-view/);
  await expect(page.locator("#distribution-filter")).toBeVisible();
  expect(await page.locator("#right-pane-controls #distribution-filter").count()).toBe(0);
});

test("highlight and filter report different statistical collections", async ({ page }) => {
  await ready(page, "chart=ternary&dual=1");
  await page.locator(".research-menu summary").click();
  await page.locator("#conditions-open").click();
  await page.locator("#filter-share").fill("30");
  await page.locator("#filter-turnout").fill("70");
  await page.locator("#filter-margin").fill("5");
  await page.locator("#filter-mode").selectOption("highlight");
  await page.locator("#filter-apply").click();
  await expect(page.locator("#scope-summary")).toContainText("368／368");
  await expect(page.locator("#scope-summary")).toContainText("高亮 24");
  await page.locator("#filter-mode").selectOption("replace");
  await page.locator("#filter-apply").click();
  await expect(page.locator("#scope-summary")).toContainText("條件篩選 24／368");
  await expect(page.locator("#scope-summary")).not.toContainText("高亮");
  await expect(page.locator("#scope-summary")).toContainText("排除 344");
});

test("initial geographic view gives the canvas full width", async ({ page }) => {
  await page.goto("/#e=president&chart=map");
  await expect(page.locator("body")).not.toHaveClass(/loading/);
  await expect(page.locator("body")).toHaveClass(/detail-closed/);
  await expect(page.locator("#detail-toggle")).toHaveAttribute("aria-expanded", "false");
  await page.locator("#detail-toggle").click();
  await expect(page.locator("body")).not.toHaveClass(/detail-closed/);
});
test("county mouse inspection creates no rectangular focus frame or automatic zoom", async ({ page }) => {
  await page.goto("/#e=president&chart=map&l=county&detail=0");
  await expect(page.locator("body")).not.toHaveClass(/loading/);
  const before = new URLSearchParams(new URL(page.url()).hash.slice(1)).get("camera"),
    county = page.locator('#map .county-geometries .geo[data-key="10007/000"]');
  await county.click();
  await expect(page.locator("#scope-summary")).toContainText("22／22");
  expect(new URLSearchParams(new URL(page.url()).hash.slice(1)).get("camera")).toBe(before);
  expect(await county.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
  expect(await page.locator("#map .selected-outline").getAttribute("d")).toBeNull();
});

test("single ternary axis names sit below the selection control", async ({ page }) => {
  await ready(page, "chart=ternary");
  const button = await page.locator("#brush-toggle").boundingBox();
  for (const label of await page.locator(".ternary-axis-key text").all()) {
    const bounds = await label.boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(button.y + button.height + 4);
  }
});
