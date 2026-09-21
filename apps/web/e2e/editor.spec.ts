import { test, expect } from "@playwright/test";

/**
 * Real-browser editor verification (work order SS3D / SS7): drives the
 * actual Puck canvas, not a hand-written document sent via curl. Needs
 * OWNER_EMAIL / OWNER_PASSWORD env vars (the bootstrapped owner account —
 * see docs/setup.md / .owner-credentials.local, which is gitignored and
 * never read directly by this file) and the site/page IDs already set up
 * in this environment's hosted Supabase project.
 *
 * Getting this running surfaced a real, separate bug (not the target of
 * this file): the editor's canvas rendered at ~48px wide, because the
 * parent admin layout's `.admin-shell` max-width (768px, meant for
 * ordinary admin forms) squeezed Puck's own fixed-width 4-column layout,
 * which needs >1000px before the canvas gets any space at all. Fixed in
 * page-editor.tsx (the editor now renders full-viewport, breaking out of
 * that wrapper) — this was only discoverable by actually rendering the
 * page in a browser and inspecting computed widths; nothing at the
 * TypeScript/HTTP level would have caught it.
 *
 * Run:
 *   OWNER_EMAIL=... OWNER_PASSWORD=... \
 *   pnpm --filter @digital-romanian/web exec playwright test editor.spec.ts
 */

const SITE_ID = process.env.E2E_SITE_ID ?? "86d86fa7-98ef-4233-9e77-924f8229ec4f";
const PAGE_ID = process.env.E2E_PAGE_ID ?? "e1746056-9b14-42ed-8484-b05805cebe7d";

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.OWNER_EMAIL || !process.env.OWNER_PASSWORD, "OWNER_EMAIL/OWNER_PASSWORD not set");
  await page.goto("/login");
  await page.fill("#email", process.env.OWNER_EMAIL!);
  await page.fill("#password", process.env.OWNER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin");
});

test("editor: ProductGrid resolves real products in the live preview, and editing a Heading through the real inspector field autosaves without the resolved-data stripping bug", async ({
  page,
}) => {
  const autosaveResponses: number[] = [];
  page.on("response", (res) => {
    if (res.request().method() === "POST" && res.url().includes(`/pages/${PAGE_ID}`)) {
      autosaveResponses.push(res.status());
    }
  });

  await page.goto(`/admin/sites/${SITE_ID}/pages/${PAGE_ID}`);
  await page.waitForTimeout(3000); // Puck client-only mount + initial resolveData

  // The live editor preview should show the real resolved products
  // (proves the staff-authenticated preview endpoint actually works),
  // not "No products to show".
  const frame = page.frameLocator("iframe").first();
  await expect(frame.getByText("Medusa Shorts")).toBeVisible({ timeout: 10_000 });
  await expect(frame.locator("img").first()).toBeVisible();

  // Select the real Heading block via Puck's own selection attribute
  // (confirmed by inspecting the rendered iframe DOM — data-puck-
  // component="<id>" is the component's stable id from the document,
  // not a guess) and edit its real inspector text field — this is what
  // actually reproduces the bug that broke: Puck's real onChange payload
  // after this edit includes ProductGrid's resolvedProducts/
  // resolvedCurrency merged into its props (verified once via a raw
  // network capture), which the old validator rejected outright.
  await frame.locator('[data-puck-component="h1"]').click();
  const textField = page.locator('#h1_text_text:visible').first();
  await expect(textField).toBeVisible({ timeout: 5000 });
  await textField.fill("Featured Products (edited by e2e)");
  await textField.blur();

  await page.waitForTimeout(1500); // debounce + request
  await expect(page.getByText("Draft saved")).toBeVisible({ timeout: 10_000 });

  expect(autosaveResponses.length).toBeGreaterThan(0);
  expect(autosaveResponses).not.toContain(400);

  // Confirm the edit actually persisted (not just "no error shown").
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(frame.getByText("Featured Products (edited by e2e)")).toBeVisible({ timeout: 10_000 });
});

test("editor: back navigation waits for a pending save before leaving", async ({ page }) => {
  await page.goto(`/admin/sites/${SITE_ID}/pages/${PAGE_ID}`);
  await page.waitForTimeout(3000);

  // Intercept the autosave POST with an artificial delay so there's a
  // real window to observe "navigation hasn't happened yet" in — without
  // this, a fast local response could complete before the assertion
  // below even runs, making the test pass for the wrong reason.
  let resolveDelay: () => void = () => {};
  const delay = new Promise<void>((resolve) => {
    resolveDelay = resolve;
  });
  await page.route(`**/admin/sites/${SITE_ID}/pages/${PAGE_ID}`, async (route) => {
    if (route.request().method() === "POST") {
      await delay;
    }
    await route.continue();
  });

  // A real edit through the real inspector field, not a synthetic DOM
  // event — genuinely marks the page dirty (handleBackClick's
  // flush-before-leaving logic only has something to do if this
  // actually happened).
  const frame = page.frameLocator("iframe").first();
  await frame.locator('[data-puck-component="h1"]').click();
  const textField = page.locator('#h1_text_text:visible').first();
  await expect(textField).toBeVisible({ timeout: 5000 });
  await textField.fill("Edited right before navigating away");
  await textField.blur();

  const backLink = page.locator('a:has-text("←")').first();
  await backLink.click();

  // Should NOT have navigated yet — still on the editor URL, because the
  // (deliberately delayed) save hasn't landed.
  await page.waitForTimeout(500);
  expect(page.url()).toContain(`/pages/${PAGE_ID}`);

  resolveDelay();
  await page.waitForURL(`**/admin/sites/${SITE_ID}`, { timeout: 10_000 });
});
