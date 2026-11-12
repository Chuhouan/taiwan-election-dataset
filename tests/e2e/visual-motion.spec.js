import { test, expect } from "@playwright/test";
test.use({ channel: "chrome" });
const ready = (page) => expect(page.locator("body")).not.toHaveClass(/loading/);
for (const width of [1280, 1440, 1920])
  test(`county identity and interruption at ${width}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/explore/?l=county");
    await ready(page);
    await expect(page.locator("#chart-question")).toBeVisible();
    await page.locator('button[data-chart="hex"]').click();
    await expect(
      page.locator(".region-transfer [data-motion-region]"),
    ).toHaveCount(22);
    for (const key of [
      "63000/000",
      "66000/000",
      "64000/000",
      "09007/000",
      "09020/000",
      "10016/000",
    ])
      await expect(page.locator(`[data-motion-region="${key}"]`)).toHaveCount(
        1,
      );
    await page.waitForTimeout(850);
    await expect(page.locator(".motion-receiving")).toHaveCount(0);
    await page.locator('button[data-chart="map"]').click();
    await page.locator('button[data-chart="hex"]').click();
    await page.locator('button[data-chart="ternary"]').click();
    await page.locator('button[data-chart="map"]').click();
    await page.locator('button[data-chart="hex"]').click();
    await page.waitForTimeout(1000);
    await expect(page.locator("#view-title")).toHaveText("等權格網");
    await expect(page.locator("#scatter .alternative-stage .unit")).toHaveCount(
      22,
    );
    await expect(
      page.locator(".region-transfer,.motion-receiving"),
    ).toHaveCount(0);
    const bounds = await page.locator("#legend").boundingBox();
    expect(bounds.y + bounds.height).toBeLessThan(900);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    expect(errors).toEqual([]);
  });
test("candidate, metric, accessible label and hover agree", async ({
  page,
}) => {
  await page.goto(
    "/explore/?l=county&chart=hex&m=share&candidate=賴清德&hex-labels=detail",
  );
  await ready(page);
  const mark = page.locator(
    '#scatter .alternative-stage [data-region-key="10004/000"]',
  );
  await expect(mark).toHaveAttribute("aria-label", /賴清德 27\.42%/);
  await expect(mark.locator(".unit-candidate")).toHaveText("賴清德");
  await mark.hover();
  await expect(page.locator("#linked-reading")).toContainText("賴清德 27.42%");
  await page.locator('[data-map-mode="territory"]').click();
  await expect(mark).toHaveAttribute("aria-label", /侯友宜 37\.03%/);
  await page.locator(".workspace-more > summary").click();
  await page.locator("#workspace-options").click();
  await page.locator("#metric-mode").selectOption("turnout");
  await expect(mark).toHaveAttribute("aria-label", /投票率/);
  expect(await mark.getAttribute("aria-label")).not.toContain("侯友宜");
});
test("scatter axis change retains each DOM mark and moves to the true new coordinates", async ({
  page,
}) => {
  await page.goto(
    "/explore/?mode=chart&chart=scatter&distribution=scatter&l=county",
  );
  await ready(page);
  await expect(page.locator(".scatter-dot")).toHaveCount(22);
  await page.evaluate(() => {
    window.motionProbe = document.querySelector(
      '.scatter-dot[data-region-key="65000/000"]',
    );
  });
  await page.locator("#axis-x").selectOption("votes");
  expect(
    await page.evaluate(
      () =>
        window.motionProbe ===
        document.querySelector('.scatter-dot[data-region-key="65000/000"]'),
    ),
  ).toBe(true);
  await page.waitForTimeout(750);
  expect(
    await page.evaluate(() =>
      Math.abs(
        +window.motionProbe.getAttribute("cx") - window.motionProbe.__data__.x,
      ),
    ),
  ).toBeLessThan(0.1);
  await expect(page.locator("#metric-formula")).toContainText("有效票");
});
test("dual view restores the original chart and camera", async ({ page }) => {
  await page.goto("/explore/?l=county&camera=1.5,0,0");
  await ready(page);
  await expect(page.locator("#zoom-value")).toHaveText("1.5×");
  await page
    .locator('#map .county-geometries .geo[data-key="10007/000"]')
    .dispatchEvent("click");
  await expect(page.locator("#zoom-value")).toHaveText("1.5×");
  await page.locator("#dual-view").click();
  await expect(page.locator("body")).toHaveClass(/dual-view/);
  await page.locator("#pane-chart-type").selectOption("hex");
  await page.locator("#dual-view").click();
  await expect(page.locator("body")).not.toHaveClass(/dual-view/);
  await expect(page.locator("#view-title")).toHaveText("地理分布");
  await expect(page.locator("#zoom-value")).toHaveText("1.5×");
});
test("reduced motion commits the final view without a spatial overlay", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore/?l=county");
  await ready(page);
  await page.locator('button[data-chart="hex"]').click();
  await expect(page.locator("#scatter .alternative-stage .unit")).toHaveCount(
    22,
  );
  await expect(page.locator(".region-transfer")).toHaveCount(0);
  await expect(page.locator("#view-title")).toHaveText("等權格網");
});
test("homepage miniatures use real result data and a return visit skips the long intro", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await expect(page.locator(".home-mini-chart")).toHaveCount(4);
  await expect(page.locator(".home-results")).toContainText("5,586,019");
  await expect(
    page.locator('[data-home-discover="votes"] .home-mini-chart circle'),
  ).toHaveCount(5);
  expect(
    await page.evaluate(() => sessionStorage.getItem("atlas-result-seen")),
  ).toBe("1");
  await page.reload();
  await ready(page);
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.id === "atlas-result-bar")
          .length,
    ),
  ).toBe(0);
});
test("historical playback speed can change while playing and a direct year selection pauses it", async ({
  page,
}) => {
  await page.goto(
    "/explore/?mode=history&history-region=swipe&history-metric=turnout&history-a=2020&history-b=2024",
  );
  await expect(page.locator("#county-history-dialog")).toBeVisible();
  await expect(page.locator(".county-history-pair")).toContainText(
    /2020.*2024.*個百分點/,
  );
  await page.locator("#county-history-speed").selectOption("900");
  await page.locator("#county-history-play").click();
  await page.locator("#county-history-speed").selectOption("2400");
  await expect(page.locator("#county-history-play")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#county-history-b").selectOption("2024");
  await expect(page.locator("#county-history-play")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.locator("#county-history-close").click();
  await page.goto(
    "/explore/?mode=history&e=legislator&chart=small&parliament-history=2024",
  );
  await expect(page.locator("#parliament-history-dialog")).toBeVisible();
  await expect(page.locator(".parliament-seat")).toHaveCount(113);
  await page.locator("#parliament-history-speed").selectOption("1000");
  await page.locator("#parliament-history-play").click();
  await page.locator("#parliament-history-speed").selectOption("2400");
  await expect(page.locator("#parliament-history-play")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator('[data-parliament-year="2020"]').click();
  await expect(page.locator("#parliament-history-play")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator(".parliament-seat")).toHaveCount(113);
});
