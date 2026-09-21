import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false, // tests share hosted Supabase + local Medusa state
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    // Puck's own 4-column editor layout (icon rail + blocks panel +
    // canvas + fields panel) needs real width to render usably —
    // confirmed via a real browser: Playwright's default 1280px desktop
    // viewport left the canvas at ~48px wide. 1600px was verified
    // sufficient.
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 1000 } } },
    // The Puck editor is a desktop-only workflow by design (same as
    // every comparable page builder — Elementor, Webflow, etc.) — its
    // fixed-width multi-panel layout isn't meant to fit a phone
    // viewport, so editor.spec.ts is excluded here rather than forced to
    // "work" at a width it was never built for. The public storefront
    // (storefront-checkout.spec.ts) still runs on both projects.
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] }, testIgnore: /editor\.spec\.ts/ },
  ],
  // Assumes `pnpm dev` (apps/web) and Medusa `pnpm dev` are already
  // running, same as the rest of this repo's verification scripts — not
  // started here, to avoid a second copy of either fighting over ports
  // with an already-running dev session.
});
