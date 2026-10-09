import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  // routes/site-page.tsx is registered twice on purpose: a `*` splat
  // does not match the bare "/" (verified — a non-empty path like
  // "/xyz" correctly reached the loader and 404ed, but "/" itself never
  // matched any leaf route at all), so the index registration covers
  // exactly that one case. Both point at the same file/loader, which
  // already handles an empty pathname as the site's home page.
  index("routes/site-page.tsx", { id: "site-page-index" }),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  // Sign-up and onboarding screens ported from digital-romanian-screens.html
  route("signup", "routes/signup.tsx"),
  route("signup/password", "routes/signup-password.tsx"),
  route("signup/created", "routes/signup-created.tsx"),
  route("onboarding/profile", "routes/onboarding-profile.tsx"),
  route("onboarding/workspace", "routes/onboarding-workspace.tsx"),
  route("reset-password", "routes/reset-password.tsx"),
  route("invitation", "routes/invitation.tsx"),
  // The workspace area from digital-romanian-screens.html. One pathless
  // layout owns the shell, the sidebar, the workspace switcher and the two
  // dialogs; the four sections are its children. The standalone file keeps
  // all of that in a single `state` object, and splitting it across four
  // sibling routes is what previously made the sidebar toggle and the
  // workspace choice reset on every click.
  //
  // The section paths are top level, as asked for, not /workspace/*. The
  // sidebar rows are the same four the file declares (All sites, Templates,
  // Team, General settings). "template" and "teams" are registered as aliases
  // of the same leaf so either spelling resolves without a redirect hop.
  // One pathless layout loads the workspace rows for BOTH the section tree
  // below and the site Overview screen (which draws its own shell but reads the
  // same rows), so moving between them is a client-side transition with no
  // second read. See routes/workspace-data.tsx.
  layout("routes/workspace-data.tsx", [
    layout("routes/workspace.tsx", [
      route("workspace", "routes/workspace-sites.tsx"),
      route("templates", "routes/templates.tsx"),
      route("template", "routes/templates.tsx", { id: "template-alias" }),
      route("team", "routes/team.tsx"),
      route("teams", "routes/team.tsx", { id: "teams-alias" }),
      route("settings", "routes/settings.tsx"),
    ]),
    // The site overview screen (sidebar + per-site navigation), same screen the
    // standalone file shows at #/overview, #/overview/pages and
    // #/overview/products. One splat registration instead of three sibling
    // routes on purpose: siblings unmount and remount the module on every
    // click, which would drop the workspace/site selection, the drawer and the
    // toasts (the same reason the workspace area uses a pathless layout). The
    // view is picked from the pathname inside the component.
    route("overview/*", "routes/overview.tsx"),
  ]),
  route("admin", "routes/admin/layout.tsx", [
    index("routes/admin/index.tsx"),
    route("sites/:siteId", "routes/admin/site.tsx"),
    route("sites/:siteId/pages", "routes/admin/pages.tsx"),
    route("sites/:siteId/publishing", "routes/admin/publishing.tsx"),
    route("sites/:siteId/preview/:previewId", "routes/admin/preview.tsx"),
    route("sites/:siteId/pages/:pageId", "routes/admin/page-editor.tsx"),
    route("sites/:siteId/store", "routes/admin/store.tsx"),
    route("sites/:siteId/store/products", "routes/admin/store-products.tsx"),
  ]),
  route("api/storefront-products", "routes/api.storefront-products.tsx"),
  route("api/preview-storefront-products", "routes/api.preview-storefront-products.tsx"),
  // Reserved commerce routes, resolved through the same verified
  // site/domain mapping as everything public. Registered before the
  // catch-all so a page a CMS author creates at slug "shop" or
  // "products" would collide here — deliberately: these paths are
  // reserved namespace once commerce is enabled for a site (Part B SS22).
  route("shop", "routes/shop.tsx"),
  route("products/:handle", "routes/product-detail.tsx"),
  route("cart", "routes/cart.tsx"),
  route("checkout", "routes/checkout.tsx"),
  // No order ID in this path on purpose — access is entirely via the
  // signed, short-lived cookie set at checkout completion, so there's
  // nothing to guess/increment from the URL at all.
  route("checkout/confirmation", "routes/checkout-confirmation.tsx"),
  route("*", "routes/site-page.tsx"),
] satisfies RouteConfig;
