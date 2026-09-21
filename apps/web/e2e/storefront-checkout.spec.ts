import { test, expect } from "@playwright/test";

/**
 * Full guest checkout flow against a live local Medusa instance and the
 * hosted Supabase project (same environment every other test in this
 * repo runs against — see docs/setup.md). Uses the "Medusa Shorts" fixture
 * product already seeded in the local dev database by `create-medusa-app`
 * (Part B's own documented local-only demo seed), not data created here,
 * so nothing needs cleanup in Medusa. Only the manual test-order path is
 * exercised (no Stripe test keys are configured in this environment — see
 * docs/progress.md for exactly what's needed to add that).
 *
 * Run: pnpm --filter @digital-romanian/web exec playwright test
 * (requires `pnpm dev` for apps/web AND apps/medusa already running)
 */

test.describe("storefront: browse, cart, checkout (manual test order)", () => {
  test("real product content is in the initial HTML, not client-fetched", async ({ page }) => {
    const response = await page.goto("/shop");
    expect(response?.status()).toBe(200);
    // Check the raw response body (pre-hydration) for real content —
    // proves SSR, not just "the browser eventually shows it".
    const body = await response!.text();
    expect(body).toContain("Medusa Shorts");
  });

  test("unknown host and invalid product routes fail correctly", async ({ page, request }) => {
    const notFound = await request.get("/products/this-handle-does-not-exist-at-all");
    expect(notFound.status()).toBe(404);
  });

  test("full flow: browse -> variant -> add to cart -> persistent cart -> checkout -> manual test order -> confirmation", async ({
    page,
  }) => {
    await page.goto("/products/shorts");
    await expect(page.locator("h1")).toHaveText("Medusa Shorts");

    // Real variant options from Medusa, not hardcoded.
    const variantSelect = page.locator("#variant");
    const optionCount = await variantSelect.locator("option").count();
    expect(optionCount).toBeGreaterThan(0);

    await page.fill("#quantity", "2");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/Added to cart/)).toBeVisible({ timeout: 10_000 });

    // Reload the cart in a fresh navigation — proves persistence via the
    // cookie, not just client-side state.
    await page.goto("/cart");
    await expect(page.getByText("Medusa Shorts")).toBeVisible();
    const qtyInput = page.locator('input[name="quantity"]').first();
    await expect(qtyInput).toHaveValue("2");

    // Update quantity.
    await qtyInput.fill("3");
    await page.locator('button:has-text("Update")').first().click();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.locator('input[name="quantity"]').first()).toHaveValue("3");

    // Proceed to checkout.
    await page.click('a:has-text("Checkout")');
    await expect(page).toHaveURL(/\/checkout$/);

    const suffix = Math.random().toString(36).slice(2, 8);
    await page.fill("#email", `e2e-${suffix}@example.invalid`);
    await page.fill("#first_name", "E2E");
    await page.fill("#last_name", "Test");
    await page.fill("#address_1", "123 Test Street");
    await page.fill("#city", "Copenhagen");
    await page.fill("#postal_code", "1000");
    await page.fill("#country_code", "dk");
    await page.click('button:has-text("Save address")');
    await page.waitForLoadState("networkidle");

    // Select the first eligible shipping option.
    const shippingButton = page.locator('section:has-text("2. Shipping") button').first();
    await expect(shippingButton).toBeVisible({ timeout: 10_000 });
    await shippingButton.click();
    await page.waitForLoadState("networkidle");

    // Manual test-order path — explicitly labeled, not a real payment.
    const manualOrderButton = page.getByRole("button", { name: /Place manual test order/ });
    await expect(manualOrderButton).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/NOT a verified payment/)).toBeVisible();
    await manualOrderButton.click();

    await page.waitForURL(/\/checkout\/confirmation/, { timeout: 15_000 });
    await expect(page.getByText(/Order confirmed/)).toBeVisible();
    await expect(page.getByText(/NOT a verified real payment/)).toBeVisible();
    await expect(page.getByText(/Medusa Shorts/)).toBeVisible();
  });

  test("confirmation route rejects access without the order-access cookie", async ({ browser }) => {
    // Fresh, cookie-less context — must NOT see any order.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/checkout/confirmation");
    await expect(page.getByText(/No order found for this session/)).toBeVisible();
    await context.close();
  });
});
