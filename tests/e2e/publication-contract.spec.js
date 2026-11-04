import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
test.use({ channel: "chrome" });
test("CSV explicitly selects collection and preserves BOM and lineage columns", async ({ page }) => {
  await page.goto("/#e=president&chart=ternary&f-candidate=柯文哲&f-share=30&f-turnout=70&f-margin=5&detail=0");
  await expect(page.locator("#scope-summary")).toContainText("24／368");
  await page.locator("#download").click();
  await expect(page.locator("#csv-range-description")).toContainText("24 個地區");
  await page.locator('#csv-form input[value="range"]').check();
  const pending = page.waitForEvent("download"); await page.locator("#csv-confirm").click();
  const bytes = await readFile(await (await pending).path());
  expect([...bytes.subarray(0, 3)]).toEqual([239, 187, 191]);
  const lines = bytes.toString("utf8").split("\r\n");
  expect(lines).toHaveLength(73);
  for (const column of ["election_id", "source_version", "boundary_version", "derived_method", "export_scope"]) expect(lines[0]).toContain(column);
});
test("bubble publication draws vector ranking and retains complete data in metadata", async ({ page }) => {
  await page.goto("/#e=president&chart=bubble&l=county&detail=0"); await expect(page.locator(".unit").first()).toBeVisible();
  const pending = page.waitForEvent("download"); await page.locator("#image-export").selectOption("svg");
  const text = await readFile(await (await pending).path(), "utf8");
  expect(text).toContain('data-publication-bubble-count="22"'); expect(text).toContain("有效票排行"); expect(text).not.toContain("NaN");
});
test("batch export contains three shared-scale figures and restores the entire analysis", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/#e=president&chart=ternary&dual=1&detail=0&context-county=63000");
  await expect(page.locator("#county-context")).toHaveValue("63000");
  const before = page.url(); await page.locator("#image-export").selectOption("publication");
  const pending = page.waitForEvent("download"); await page.locator("#publication-batch").click();
  const bytes = await readFile(await (await pending).path());
  const result = JSON.parse(execFileSync(process.platform === "win32" ? "python" : "python3",
    ["-X", "utf8", "-c", "import sys,io,zipfile,json;z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()));print(json.dumps({'names':z.namelist(),'metadata':json.loads(z.read('metadata.json')),'valid':all(b'NaN' not in z.read(n) for n in z.namelist())}))"], { input: bytes, encoding: "utf8" }));
  expect(result.names.filter((name) => name.endsWith(".svg"))).toHaveLength(3);
  expect(result.metadata.count).toBe(368); expect(result.metadata.scaleDomain).toEqual([0, 65]); expect(result.valid).toBe(true);
  expect(page.url()).toBe(before); await expect(page.locator(".ternary-dot")).toHaveCount(368);
  await page.locator("#publication-close").click(); await expect(page.locator("#county-context")).toHaveValue("63000");
});
