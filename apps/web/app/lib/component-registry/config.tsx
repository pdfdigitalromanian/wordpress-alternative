import { safeLink } from "../page-model";
import type { Config, Slot } from "@puckeditor/core";

/**
 * Shared component definitions for the visual editor (`<Puck>`) and the
 * public SSR renderer (`<Render>`) — the same `render` function runs in
 * both, so what an editor sees in the canvas is exactly what a visitor
 * gets (Part A SS1, SS5). Intentionally minimal for M2: Section, Heading,
 * Text, Button. The fuller component list in Part A SS6 (grids, cards,
 * accordions, forms, the Three.js scene, ...) is added incrementally —
 * this file is where each one gets registered.
 *
 * Styling here is deliberately plain, semantic HTML with no baked-in
 * decorative design — the blank-theme requirement (Part A SS4) means a
 * new site must not inherit visual opinions from these components. Real
 * design-token wiring (CSS variables driven by the site's theme
 * settings) is a later milestone; for now components render structure,
 * not a look.
 */

export type ProductGridResolvedProduct = {
  id: string;
  title: string;
  handle: string | null;
  thumbnail: string | null;
  price: number | null;
};

export type ComponentProps = {
  Section: { content: Slot; padding: "none" | "small" | "medium" | "large" };
  Heading: { text: string; level: "h1" | "h2" | "h3" };
  Text: { text: string };
  Button: { label: string; href: string };
  Image: { src: string; alt: string; caption: string };
  Spacer: { height: number };
  Divider: { color: string };
  Columns: { columns: number; gap: number; content: Slot };
  Card: { title: string; text: string };
  FAQ: { question: string; answer: string };
  ShopLink: { label: string; destination: "shop" | "cart" };
  ProductCard: { product: { id: string; title: string } | null; resolvedProducts?: ProductGridResolvedProduct[]; resolvedCurrency?: string | null; resolvedError?: string | null };
  ProductGrid: {
    columns: 2 | 3 | 4;
    spacing: "small" | "medium" | "large";
    limit: number;
    categoryId: string;
    // Populated by resolveData below, never edited directly — not a
    // real Puck field (no `fields` entry for these), just extra render
    // props Puck's resolve step is allowed to attach.
    resolvedProducts?: ProductGridResolvedProduct[];
    resolvedCurrency?: string | null;
    resolvedError?: string | null;
  };
};

/** metadata shape both <Puck> (editor) and <Render>/resolveAllData
 * (public) are called with — see page-editor.tsx, site-page.tsx, shop.tsx.
 * `mode` picks which of the two trust-boundary-separated API routes
 * resolveData below calls: "preview" (staff-authenticated, explicit
 * siteId — the site being edited may have no public domain yet) or
 * "public" (host-derived siteId only, no query-string siteId is ever
 * sent — see api.storefront-products.tsx).
 */
export type StorefrontMetadata = {
  siteId: string;
  origin: string;
  mode: "preview" | "public";
};

const paddingValues: Record<ComponentProps["Section"]["padding"], string> = {
  none: "0",
  small: "1rem",
  medium: "2rem",
  large: "4rem",
};

async function fetchProducts(metadata: unknown, extra: Record<string, string> = {}) {
  const meta = metadata as Partial<StorefrontMetadata>;
  if (!meta?.siteId || !meta.origin) return { products: [], currencyCode: null, error: "Connect a store to show products." };
  const url = new URL(meta.mode === "preview" ? "/api/preview-storefront-products" : "/api/storefront-products", meta.origin);
  url.searchParams.set("siteId", meta.siteId);
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Products could not be loaded. Check the store connection.");
  return await response.json() as { products: ProductGridResolvedProduct[]; currencyCode: string | null; error: string | null };
}

export const componentConfig: Config<ComponentProps> = {
  categories: {
    basic: { title: "Basic", components: ["Heading", "Text", "Image", "Button", "Spacer", "Divider"] },
    layout: { title: "Layout & content", components: ["Section", "Columns", "Card", "FAQ"] },
    commerce: { title: "Shop", components: ["ProductGrid", "ProductCard", "ShopLink"] },
  },
  components: {
    Section: {
      label: "Section",
      fields: {
        content: { type: "slot" },
        padding: {
          type: "select",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "small" },
            { label: "Medium", value: "medium" },
            { label: "Large", value: "large" },
          ],
        },
      },
      defaultProps: { content: [], padding: "medium" },
      render: ({ content: Content, padding }) => (
        <section style={{ padding: paddingValues[padding] }}>
          <Content minEmptyHeight={80} />
        </section>
      ),
    },
    Heading: {
      label: "Heading",
      fields: {
        text: { type: "text" },
        level: {
          type: "select",
          options: [
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
          ],
        },
      },
      defaultProps: { text: "Heading", level: "h2" },
      render: ({ text, level }) => {
        const Tag = level;
        return <Tag style={{ fontSize: level === "h1" ? "clamp(32px, 5vw, 56px)" : level === "h2" ? "clamp(24px, 3vw, 36px)" : "24px", lineHeight: 1.15, fontWeight: 650, margin: "0 0 20px" }}>{text}</Tag>;
      },
    },
    Text: {
      label: "Text",
      fields: {
        text: { type: "textarea" },
      },
      defaultProps: { text: "Text block." },
      render: ({ text }) => <p style={{ lineHeight: 1.75, whiteSpace: "pre-line", margin: "0 0 20px", fontSize: 16 }}>{text}</p>,
    },
    Button: {
      label: "Button",
      fields: {
        label: { type: "text" },
        href: { type: "text" },
      },
      defaultProps: { label: "Click me", href: "#" },
      render: ({ label, href }) => <a href={safeLink(href)} style={{ display: "inline-flex", padding: "12px 22px", borderRadius: 6, background: "var(--site-accent, #171717)", color: "white", textDecoration: "none", margin: "8px 0" }}>{label}</a>,
    },
    Image: {
      label: "Image", fields: { src: { type: "text", label: "Image URL (https://)" }, alt: { type: "text", label: "Alternative text (empty for decorative images)" }, caption: { type: "text" } },
      defaultProps: { src: "", alt: "", caption: "" },
      render: ({ src, alt, caption }) => <figure style={{ margin: "0 0 24px" }}>{/^https?:\/\//i.test(src) ? <img src={src} alt={alt} loading="lazy" style={{ width: "100%", height: "auto", borderRadius: 8 }} /> : <div style={{ background: "#f1f0eb", padding: 48, textAlign: "center" }}>Choose an image in the inspector</div>}{caption ? <figcaption style={{ fontSize: 14, marginTop: 8 }}>{caption}</figcaption> : null}</figure>,
    },
    Spacer: { fields: { height: { type: "number", min: 8, max: 240 } }, defaultProps: { height: 40 }, render: ({ height }) => <div aria-hidden="true" style={{ height: Math.min(240, Math.max(8, height)) }} /> },
    Divider: { fields: { color: { type: "text" } }, defaultProps: { color: "#deddd6" }, render: ({ color }) => <hr style={{ border: 0, borderTop: `1px solid ${color}`, margin: "24px 0" }} /> },
    Columns: { fields: { columns: { type: "select", options: [2, 3, 4].map(value => ({ label: String(value), value })) }, gap: { type: "number", min: 0, max: 80 }, content: { type: "slot" } }, defaultProps: { columns: 2, gap: 24, content: [] }, render: ({ columns, gap, content: Content }) => <Content style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${Math.max(180, 800 / columns)}px), 1fr))`, gap }} /> },
    Card: { fields: { title: { type: "text" }, text: { type: "textarea" } }, defaultProps: { title: "Something worth sharing", text: "Tell your visitors more." }, render: ({ title, text }) => <article style={{ border: "1px solid #deddd6", borderRadius: 8, padding: 28 }}><h3 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>{title}</h3><p style={{ lineHeight: 1.7, whiteSpace: "pre-line" }}>{text}</p></article> },
    FAQ: { label: "Accordion / FAQ", fields: { question: { type: "text" }, answer: { type: "textarea" } }, defaultProps: { question: "What would you like to know?", answer: "Add a useful answer here." }, render: ({ question, answer }) => <details style={{ padding: "20px 0", borderBottom: "1px solid #ddd" }}><summary style={{ fontWeight: 600, cursor: "pointer" }}>{question}</summary><p style={{ paddingTop: 16, lineHeight: 1.7, whiteSpace: "pre-line" }}>{answer}</p></details> },
    ShopLink: { label: "Shop / cart button", fields: { label: { type: "text" }, destination: { type: "select", options: [{ label: "Shop", value: "shop" }, { label: "Cart", value: "cart" }] } }, defaultProps: { label: "Shop now", destination: "shop" }, render: ({ label, destination }) => <a href={destination === "cart" ? "/cart" : "/shop"} style={{ display: "inline-flex", padding: "12px 22px", border: "1px solid currentColor", borderRadius: 6 }}>{label} →</a> },
    ProductCard: {
      label: "Featured product",
      fields: { product: { type: "external", placeholder: "Choose a store product", fetchList: async () => [], mapProp: (item) => ({ id: item.id, title: item.title }), getItemSummary: (item) => item?.title || "Choose a product" } },
      defaultProps: { product: null },

      resolveData: async ({ props }, { metadata }) => {
        if (!props.product?.id) return { props: { ...props, resolvedProducts: [], resolvedError: null } };
        try { const result = await fetchProducts(metadata, { productId: props.product.id }); return { props: { ...props, resolvedProducts: result.products, resolvedCurrency: result.currencyCode, resolvedError: result.error } }; }
        catch { return { props: { ...props, resolvedProducts: [], resolvedError: "Products could not be loaded. Check the store connection." } }; }
      },
      render: ({ product, resolvedProducts, resolvedCurrency, resolvedError }) => {
        const item = resolvedProducts?.[0];
        if (resolvedError) return <p role="status">{resolvedError}</p>;
        if (!item) return <div style={{ padding: 32, border: "1px dashed #bbb", textAlign: "center" }}>{product ? "This product is not currently available." : "Choose a product in the inspector. Prices stay connected to your store."}</div>;
        return <article style={{ maxWidth: 480, border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>{item.thumbnail ? <img src={item.thumbnail} alt={item.title} style={{ width: "100%", aspectRatio: "4/3", objectFit: "contain" }} /> : null}<div style={{ padding: 24 }}><h3 style={{ fontSize: 24, fontWeight: 600 }}>{item.title}</h3>{item.price != null && resolvedCurrency ? <p style={{ margin: "12px 0" }}>{new Intl.NumberFormat("en", { style: "currency", currency: resolvedCurrency }).format(item.price)}</p> : null}<a href={item.handle ? `/products/${item.handle}` : "/shop"}>Choose options →</a></div></article>;
      },
    },
    ProductGrid: {
      label: "Product grid",
      fields: {
        columns: {
          type: "select",
          options: [
            { label: "2", value: 2 },
            { label: "3", value: 3 },
            { label: "4", value: 4 },
          ],
        },
        spacing: {
          type: "select",
          options: [
            { label: "Small", value: "small" },
            { label: "Medium", value: "medium" },
            { label: "Large", value: "large" },
          ],
        },
        limit: { type: "number", min: 1, max: 24 },
        categoryId: { type: "text" },
      },
      defaultProps: { columns: 3, spacing: "medium", limit: 8, categoryId: "" },
      resolveData: async ({ props }, { metadata }) => {
        const meta = metadata as Partial<StorefrontMetadata> | undefined;
        if (!meta?.siteId || !meta?.origin) {
          // No storefront context (e.g. this config object used outside
          // a resolved site) — leave products empty rather than guess.
          return { props: { ...props, resolvedProducts: [], resolvedError: null } };
        }

        // Two separate, trust-boundary-separated endpoints (see
        // api.storefront-products.tsx / api.preview-storefront-
        // products.tsx) — never one endpoint that trusts an anonymous
        // caller's siteId query param.
        const path = meta.mode === "preview" ? "/api/preview-storefront-products" : "/api/storefront-products";
        const url = new URL(path, meta.origin);
        url.searchParams.set("siteId", meta.siteId);
        url.searchParams.set("limit", String(props.limit ?? 8));
        if (props.categoryId) url.searchParams.set("categoryId", props.categoryId);

        try {
          const response = await fetch(url);
          const data = (await response.json()) as {
            products: ProductGridResolvedProduct[];
            currencyCode: string | null;
            error: string | null;
          };
          return {
            props: {
              ...props,
              resolvedProducts: data.products,
              resolvedCurrency: data.currencyCode,
              resolvedError: data.error,
            },
          };
        } catch (error) {
          return {
            props: {
              ...props,
              resolvedProducts: [],
              resolvedError: error instanceof Error ? error.message : "Could not load products.",
            },
          };
        }
      },
      render: ({ columns, spacing, resolvedProducts, resolvedCurrency, resolvedError }) => {
        const gap = spacing === "small" ? "0.5rem" : spacing === "large" ? "2rem" : "1rem";
        if (resolvedError) {
          return <p role="alert">Products unavailable: {resolvedError}</p>;
        }
        if (!resolvedProducts || resolvedProducts.length === 0) {
          return <p>No products to show.</p>;
        }
        return (
          <ul
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${Math.max(160, 700 / columns)}px), 1fr))`,
              gap,
              listStyle: "none",
              padding: 0,
            }}
          >
            {resolvedProducts.map((product) => (
              <li key={product.id}>
                <a href={product.handle ? `/products/${product.handle}` : "#"}>
                  {product.thumbnail ? (
                    // Product imagery from the connected Medusa instance
                    // — dimensions vary per product, so no fixed width/
                    // height is asserted here.
                    <img src={product.thumbnail} alt={product.title} style={{ width: "100%", height: "auto" }} />
                  ) : null}
                  <div>{product.title}</div>
                  {product.price !== null && resolvedCurrency ? (
                    <div>
                      {new Intl.NumberFormat(undefined, { style: "currency", currency: resolvedCurrency.toUpperCase() }).format(
                        product.price,
                      )}
                    </div>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        );
      },
    },
  },
  root: {
    fields: {
      content: { type: "slot" },
      seoTitle: { type: "text", label: "Search title (optional)" },
      description: { type: "textarea", label: "Search description" },
    },
    render: ({ content: Content }) => <Content minEmptyHeight={200} />,
  },
};

/** Bind the picker before Puck mounts it: external fields load their initial
 * result set on mount, before a later resolveFields update can take effect. */
export function createEditorConfig(metadata: StorefrontMetadata): Config<ComponentProps> {
  return { ...componentConfig, components: { ...componentConfig.components, ProductCard: {
    ...componentConfig.components.ProductCard,
    fields: { product: {
      type: "external", placeholder: "Search your published products", showSearch: true,
      fetchList: async ({ query }) => {
        const result = await fetchProducts(metadata, { q: query, limit: "24" });
        if (result.error) throw new Error(result.error);
        return result.products;
      },
      mapProp: item => ({ id: item.id, title: item.title }),
      mapRow: item => ({ Product: item.title, Path: item.handle || "No public path" }),
      getItemSummary: item => item?.title || "Choose a product",
    } },
  } } };
}
