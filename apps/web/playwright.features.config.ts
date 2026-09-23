import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e", testMatch: "features.spec.ts", workers: 1, timeout: 45000,
  use: { baseURL: "http://localhost:5189", viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: { command: "node e2e/support/feature-server.mjs", url: "http://localhost:5189/login", reuseExistingServer: false, timeout: 30000 },
});
