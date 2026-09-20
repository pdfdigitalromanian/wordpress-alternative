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
 */
export type StorefrontMetadata = {
  siteId: string;
  origin: string;
};

const paddingValues: Record<ComponentProps["Section"]["padding"], string> = {
  none: "0",
  small: "1rem",
  medium: "2rem",
  large: "4rem",
};

export const componentConfig: Config<ComponentProps> = {
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
        return <Tag>{text}</Tag>;
      },
    },
    Text: {
      label: "Text",
      fields: {
        text: { type: "textarea" },
      },
      defaultProps: { text: "Text block." },
      render: ({ text }) => <p>{text}</p>,
    },
    Button: {
      label: "Button",
      fields: {
        label: { type: "text" },
        href: { type: "text" },
      },
      defaultProps: { label: "Click me", href: "#" },
      render: ({ label, href }) => <a href={href}>{label}</a>,
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

        const url = new URL("/api/storefront-products", meta.origin);
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
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
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
    },
    render: ({ content: Content }) => <Content minEmptyHeight={200} />,
  },
};
