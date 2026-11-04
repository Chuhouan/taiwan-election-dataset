import { test, expect } from "@playwright/test";
test.use({ channel: "chrome" });
for (const chart of ["map", "hex", "bubble", "ternary", "small", "scatter"]) {
  test(`publication typography and margins ${chart}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(`/#e=president&chart=${chart}&detail=0`);
    await expect(page.locator("body")).not.toHaveClass(/loading/);
    if (chart === "bubble") await expect(page.locator(".unit").first()).toBeVisible();
    await page.locator("#image-export").selectOption("publication");
    for (const [format, width, height] of [["landscape", 1600, 1000], ["square", 1200, 1200], ["paper", 1800, 1200]]) {
      await page.locator("#publication-size").selectOption(format);
      const result = await page.evaluate(async () => {
        const source = await (await fetch(document.querySelector("#publication-image").src)).text(),
          svg = new DOMParser().parseFromString(source, "image/svg+xml").documentElement;
        document.body.append(svg); svg.style.cssText = "position:fixed;left:-20000px;top:0;opacity:0;pointer-events:none";
        const width = +svg.getAttribute("width"), height = +svg.getAttribute("height"),
          clipped = [...svg.children].filter((n) => n.tagName === "text").map((node) => ({ text: node.textContent, box: node.getBBox() })).filter(({ box }) => box.x < -1 || box.y < -1 || box.x + box.width > width + 1 || box.y + box.height > height + 1).map((n) => n.text),
          invalid = /NaN|Infinity/.test(source), hasSource = source.includes("中央選舉委員會"), hasVersion = svg.hasAttribute("data-application-version");
        svg.remove(); return { width, height, clipped, invalid, hasSource, hasVersion };
      });
      expect(result).toEqual({ width, height, clipped: [], invalid: false, hasSource: true, hasVersion: true });
    }
  });
}
