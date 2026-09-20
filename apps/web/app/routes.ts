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
  route("admin", "routes/admin/layout.tsx", [
    index("routes/admin/index.tsx"),
    route("sites/:siteId", "routes/admin/site.tsx"),
    route("sites/:siteId/pages/:pageId", "routes/admin/page-editor.tsx"),
    route("sites/:siteId/store", "routes/admin/store.tsx"),
    route("sites/:siteId/store/products", "routes/admin/store-products.tsx"),
  ]),
  route("*", "routes/site-page.tsx"),
] satisfies RouteConfig;
