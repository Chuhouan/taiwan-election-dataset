import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python scripts/serve.py",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
});
