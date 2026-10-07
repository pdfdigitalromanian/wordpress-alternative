import { test, expect } from "@playwright/test";
const base = "/admin/sites/11111111-1111-4111-8111-111111111111";
const fixture = "http://127.0.0.1:5188";
test.beforeEach(async ({ page, request }) => {
  await request.post(`${fixture}/__test/reset`);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email address").fill("owner@example.test");
  await page.getByLabel("Password", { exact: true }).fill("local-fixture-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // The prototype's order is profile -> workspace -> /workspace, so a signed-in
  // account with both lands on the workspace screen. /admin is the per-site
  // editor and is only ever entered from there.
  await expect(page).toHaveURL(/\/workspace$/);
});

test("blank page → click to insert → saved preview → reviewed publication", async ({ page, request }) => {
  await page.goto(`${base}/pages/home-page`);
  await expect(page.getByRole("heading", { name: "Start building your page" })).toBeVisible();
  await page.getByRole("button", { name: "Add heading", exact: true }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page).toHaveURL(/\/preview\/home-page$/);
  await expect(page.getByRole("heading", { name: "Heading", exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("private-preview.png") });
  const response = await page.request.get(`${base}/preview/home-page`);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await page.goto(`${base}/publishing`);
  await page.getByRole("checkbox").check();
  await page.getByLabel("Release name").fill("First release");
  await page.getByRole("button", { name: "Publish site", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("now live");
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.tables.release_pages[0].document.root.props.content[0].type).toBe("Heading");
});

test("page creation blocks reserved routes and inserts only an explicitly selected starter", async ({ page }) => {
  await page.goto(`${base}/pages`);
  await page.getByRole("button", { name: "Add page" }).click();
  await page.getByLabel("Page title", { exact: true }).fill("Our story");
  await page.getByLabel("Page path").fill("shop");
  await page.getByRole("button", { name: "Create & edit" }).click();
  await expect(page.getByRole("alert")).toContainText("reserved");
  await page.getByLabel("Page path").fill("our-story");
  await page.getByLabel("About us", { exact: false }).check();
  await page.getByRole("button", { name: "Create & edit" }).click();
  await expect(page).toHaveURL(/\/pages\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Start building your page" })).toHaveCount(0);
  await expect(page.frameLocator("iframe").getByRole("heading", { name: "A little about us." })).toBeVisible();
});

test("product creation writes a real adapter request as draft and supports another product", async ({ page, request }) => {
  await page.goto(`${base}/store/products`);
  await expect(page.getByText("Linen shirt", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add product" }).click();
  await page.getByLabel("Product name").fill("Cotton tote");
  await page.getByLabel("Product path").fill("cotton-tote");
  await page.screenshot({ path: test.info().outputPath("add-product.png") });
  await page.getByRole("button", { name: "Create product draft" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("created as a draft");
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.productWrites).toHaveLength(1);
  expect(state.productWrites[0]).toMatchObject({ title: "Cotton tote", handle: "cotton-tote", status: "draft" });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByRole("button", { name: "Create product draft" })).toBeEnabled();
});

test("shop searches the connected catalog and keeps cart navigation visible", async ({ page }) => {
  await page.goto("/shop");
  await expect(page.getByText("Linen shirt", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Your cart" })).toBeVisible();
  await page.getByLabel("Find a product").fill("missing");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("No products are available right now.")).toBeVisible();
});

test("viewer cannot mutate pages or create products; phone page list reflows", async ({ page, request }) => {
  await request.post(`${fixture}/__test/role`, { data: { role: "viewer" } });
  await page.goto(`${base}/pages`);
  await expect(page.getByText("Read-only access")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add page" })).toHaveCount(0);
  const write = await page.request.post(`${base}/pages`, { form: { intent: "create", title: "Forbidden", slug: "forbidden" } });
  expect(await write.text()).toContain("cannot change");
  const products = await page.request.post(`${base}/store/products`, { form: { title: "Forbidden", handle: "forbidden" } });
  expect(products.status()).toBe(403);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("pages-mobile.png"), fullPage: true });
});

test("featured product is picked from the store and resolved in private preview", async ({ page, request }) => {
  await page.goto(`${base}/pages/home-page`);
  await page.getByLabel("Add element", { exact: true }).selectOption("ProductCard");
  await page.getByRole("button", { name: "Insert element", exact: true }).click();
  await page.getByRole("button", { name: "Search your published products" }).click();
  await page.getByRole("cell", { name: "Linen shirt", exact: true }).click();
  // Navigate immediately: selection must persist even while product data resolves.
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Linen shirt", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Choose options" })).toHaveAttribute("href", "/products/linen-shirt");
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  const props = state.tables.pages[0].draft_document.root.props.content[0].props;
  expect(props.product.id).toBe("product-shirt");
  expect(props).not.toHaveProperty("resolvedProducts");
});

test("failed autosave preserves the draft and retry recovers it", async ({ page, request }) => {
  await request.post(`${fixture}/__test/save-failure`, { data: { enabled: true } });
  await page.goto(`${base}/pages/home-page`);
  await page.getByRole("button", { name: "Add heading", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry saving" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download my draft" })).toBeVisible();
  await request.post(`${fixture}/__test/save-failure`, { data: { enabled: false } });
  await page.getByRole("button", { name: "Retry saving" }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.tables.pages[0].draft_document.root.props.content).toHaveLength(1);
});

test("stale publishing review refuses to publish newer, unreviewed changes", async ({ page, request }) => {
  await page.goto(`${base}/publishing`);
  const token = await page.locator('input[name="review_token"]').first().inputValue();
  await page.request.post(`${base}/pages`, { form: { intent: "update", page_id: "home-page", title: "Changed after review", slug: "", known_updated_at: "2026-01-01T00:00:00.000Z" } });
  const response = await page.request.post(`${base}/publishing`, { form: { intent: "publish", review_token: token, confirmed: "yes" } });
  expect(await response.text()).toContain("drafts or live release changed");
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.tables.releases).toHaveLength(0);
});

test("duplicate and remove are scoped and require current page identity", async ({ page, request }) => {
  await page.request.post(`${base}/pages`, { form: { intent: "duplicate", page_id: "home-page", title: "Home copy", slug: "home-copy" } });
  let state = await (await request.get(`${fixture}/__test/state`)).json();
  const copy = state.tables.pages.find((item: { slug: string }) => item.slug === "home-copy");
  expect(copy).toBeTruthy();
  const stale = await page.request.post(`${base}/pages`, { form: { intent: "update", page_id: copy.id, title: "Stale", slug: "home-copy", known_updated_at: "old" } });
  expect(await stale.text()).toContain("changed while you were working");
  await page.request.post(`${base}/pages`, { form: { intent: "delete", page_id: copy.id, known_updated_at: copy.draft_updated_at, confirmation: copy.title } });
  state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.tables.pages).toHaveLength(1);
  expect(state.tables.pages[0].id).toBe("home-page");
});
// The workspace shell screens ported from digital-romanian-screen.html: the
// profile dropdown (line 1470-1476) and the Library / Team / General settings
// views (renderTemplates 2103, renderTeam 2192, renderSettings 2251).

test("profile dropdown is the only place sign out lives", async ({ page }) => {
  await page.goto("/templates");
  const trigger = page.getByRole("button", { name: "Account menu" });
  await trigger.click();
  const menu = page.locator(".me-menu");
  await expect(menu.getByRole("link", { name: "Edit profile" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Workspace settings" })).toHaveAttribute("href", "/settings");
  await expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.locator(".switcher-signout")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("library lists the prototype's demo templates; Create stays on the page", async ({ page }) => {
  await page.goto("/templates");
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  // The standalone file's demoLibrary seeds nine templates; the featured view
  // shows the four most-used and a "View all" toggle.
  await expect(page.locator(".tpl")).toHaveCount(4);
  await expect(page.getByText("Hero section", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View all templates" }).click();
  await expect(page.locator(".tpl")).toHaveCount(9);
  // Create template must NOT leave the page: it adds an "Untitled template"
  // item in memory and toasts, exactly like the file's [data-new-tpl] handler.
  await page.getByRole("button", { name: "Create template" }).click();
  await expect(page).toHaveURL(/\/templates$/);
  await expect(page.getByRole("status").last()).toContainText("Untitled template created");
  await expect(page.locator(".tpl")).toHaveCount(10);
  // The five component tiles with the prototype's counts.
  await expect(page.getByRole("button", { name: /Buttons/ })).toBeVisible();
  await expect(page.locator(".comp")).toHaveCount(5);
});

test("team lists memberships and an owner can change a role", async ({ page, request }) => {
  await page.goto("/team");
  await expect(page.getByRole("heading", { name: "Workspace members" })).toBeVisible();
  const rows = page.locator("#team-rows .mrow");
  await expect(rows).toHaveCount(3);
  await expect(page.getByText("Ana Popescu", { exact: true })).toBeVisible();
  await expect(page.getByText("(you)", { exact: false })).toBeVisible();
await rows.filter({ hasText: "Mihai Ionescu" }).getByRole("button", { name: /More actions/ }).click();
  await page.getByRole("button", { name: /^Administrator/ }).click();
  // The pill label (roleLabel) abbreviates administrator to Admin.
  await expect(page.locator("#team-rows").getByText("Admin", { exact: true })).toHaveCount(2);
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.tables.workspace_memberships.map((m: { role: string }) => m.role)).toEqual(["owner", "administrator", "administrator"]);
});

test("general settings saves the workspace name and reports skipped fields", async ({ page, request }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Workspace settings" })).toBeVisible();
const save = page.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeDisabled();
  // scoped to #set-name: the switcher's "add workspace" form also labels an
  // input "Workspace name", so the un-scoped byLabel assertion is ambiguous.
  await page.locator("#set-name").fill("Renamed workspace");
  await page.locator("#set-lang").selectOption("fr");
  await page
    .locator('input[aria-label="Upload workspace image"]')
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64") });
  await expect(save).toBeEnabled();
  await save.click();
await expect(page.getByRole("status").last()).toContainText("Not applied yet: workspace image, default language");
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.tables.workspaces[0].name).toBe("Renamed workspace");
});

test("owner can transfer workspace ownership to another member", async ({ page, request }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Transfer ownership", exact: true }).click();
  await page.locator("#tr-list label", { hasText: "Ana Popescu" }).locator("input").check();
  await page.locator("#tr-ack").check();
  await page.locator("#tr-confirm").fill("TRANSFER");
  await expect(page.locator("#tr-submit")).toBeEnabled();
  await page.locator("#tr-submit").click();
  await expect(page.getByRole("status").last()).toContainText("Ownership transferred. You're now an administrator");
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(
    state.tables.workspace_memberships.map((m: { role: string }) => m.role).sort(),
  ).toEqual(["administrator", "editor", "owner"]);
  // No longer the owner, so the danger zone is locked instead of transferable.
  await expect(page.getByText("Workspace owner only", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/can transfer ownership or delete this workspace/)).toBeVisible();
});

test("danger zone deletes the workspace only after a typed confirmation", async ({ page, request }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete workspace", exact: true }).click();
  await page.locator("#dw-confirm").fill("wrong");
  await expect(page.locator("#dw-submit")).toBeDisabled();
  await page.locator("#dw-confirm").fill("test");
  await expect(page.locator("#dw-submit")).toBeEnabled();
  await page.locator("#dw-submit").click();
  await expect(page).toHaveURL(/\/onboarding\/workspace$/);
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.tables.workspaces).toHaveLength(0);
  expect(state.tables.workspace_memberships).toHaveLength(0);
});
