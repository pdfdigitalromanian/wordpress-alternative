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

export type ComponentProps = {
  Section: { content: Slot; padding: "none" | "small" | "medium" | "large" };
  Heading: { text: string; level: "h1" | "h2" | "h3" };
  Text: { text: string };
  Button: { label: string; href: string };
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
  },
  root: {
    fields: {
      content: { type: "slot" },
    },
    render: ({ content: Content }) => <Content minEmptyHeight={200} />,
  },
};
