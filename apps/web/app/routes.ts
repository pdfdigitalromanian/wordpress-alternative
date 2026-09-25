import { type RouteConfig, index, route } from "@react-router/dev/routes";

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
  route("reset-password", "routes/reset-password.tsx"),
  route("invitation", "routes/invitation.tsx"),
  route("workspace", "routes/overview.tsx"),
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
