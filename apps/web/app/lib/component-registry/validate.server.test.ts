import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePuckDocument, type ValidatableConfig } from "./validate.server.ts";

// Mirrors the shape of the real componentConfig.tsx (Section/Heading/
// Text/Button/ProductGrid) without importing it — that file has JSX,
// which Node's native TS runner used to execute this test cannot load.
const testConfig: ValidatableConfig = {
  components: {
    Section: { fields: { content: { type: "slot" }, padding: { type: "select" } } },
    Heading: { fields: { text: { type: "text" }, level: { type: "select" } } },
    Text: { fields: { text: { type: "textarea" } } },
    Button: { fields: { label: { type: "text" }, href: { type: "text" } } },
    ProductGrid: {
      fields: {
        columns: { type: "select" },
        spacing: { type: "select" },
        limit: { type: "number" },
        categoryId: { type: "text" },
      },
    },
  },
};

function doc(content: unknown[]) {
  return { content: [], root: { props: { content } } };
}

function validate(document: unknown) {
  return validatePuckDocument(document, testConfig);
}

test("accepts an empty document", () => {
  const result = validate(doc([]));
  assert.equal(result.ok, true);
});

test("accepts a valid known component", () => {
  const result = validate(doc([{ type: "Heading", props: { id: "h1", text: "Hi", level: "h1" } }]));
  assert.equal(result.ok, true);
});

test("rejects an unknown component type", () => {
  const result = validate(doc([{ type: "ScriptInjector", props: { id: "x" } }]));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Unknown component type/);
});

test("strips (does not reject) a prop not declared in the component's fields", () => {
  const result = validate(doc([{ type: "Heading", props: { id: "h1", text: "Hi", level: "h1", onClick: "alert(1)" } }]));
  assert.equal(result.ok, true);
  if (result.ok) {
    const heading = (result.document as any).root.props.content[0];
    assert.equal("onClick" in heading.props, false);
    assert.equal(heading.props.text, "Hi");
  }
});

test("strips Puck's real resolveData extras from ProductGrid (regression: real browser autosave included these and the old validator rejected the whole save)", () => {
  const result = validate(
    doc([
      {
        type: "ProductGrid",
        props: {
          id: "pg1",
          limit: 4,
          columns: 3,
          spacing: "medium",
          categoryId: "",
          resolvedProducts: [{ id: "prod_1", title: "Thing", handle: "thing", thumbnail: null, price: 10 }],
          resolvedCurrency: "eur",
          resolvedError: null,
        },
      },
    ]),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    const grid = (result.document as any).root.props.content[0];
    assert.equal("resolvedProducts" in grid.props, false);
    assert.equal("resolvedCurrency" in grid.props, false);
    assert.equal("resolvedError" in grid.props, false);
    assert.equal(grid.props.columns, 3);
    assert.equal(grid.props.limit, 4);
  }
});

test("rejects a component missing an id", () => {
  const result = validate(doc([{ type: "Heading", props: { text: "Hi", level: "h1" } }]));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /missing an id/);
});

test("recurses into a valid slot and strips extras inside it too", () => {
  const result = validate(
    doc([
      {
        type: "Section",
        props: {
          id: "s1",
          padding: "medium",
          content: [{ type: "Text", props: { id: "t1", text: "hi", injected: "nope" } }],
        },
      },
    ]),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    const section = (result.document as any).root.props.content[0];
    const text = section.props.content[0];
    assert.equal("injected" in text.props, false);
    assert.equal(text.props.text, "hi");
  }
});

test("rejects an invalid component nested inside a valid slot", () => {
  const result = validate(
    doc([
      {
        type: "Section",
        props: { id: "s1", padding: "medium", content: [{ type: "NotReal", props: { id: "x" } }] },
      },
    ]),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Unknown component type/);
});

test("rejects a raw input document over the input size cap", () => {
  const hugeText = "x".repeat(600_000);
  const result = validate(doc([{ type: "Text", props: { id: "t1", text: hugeText } }]));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /too large/);
});

test("a large resolved-data payload that shrinks after stripping is accepted", () => {
  // Simulates a real ProductGrid autosave with a sizeable resolved
  // product list — large as INPUT, small once sanitized (resolved data
  // is dropped), so it must not be rejected by either size cap.
  const manyProducts = Array.from({ length: 50 }, (_, i) => ({
    id: `prod_${i}`,
    title: `Product ${i} with a fairly long descriptive title for realism`,
    handle: `product-${i}`,
    thumbnail: `https://example.invalid/images/product-${i}-front-view.png`,
    price: 1000 + i,
  }));
  const result = validate(
    doc([
      {
        type: "ProductGrid",
        props: {
          id: "pg1",
          limit: 8,
          columns: 3,
          spacing: "medium",
          categoryId: "",
          resolvedProducts: manyProducts,
          resolvedCurrency: "eur",
          resolvedError: null,
        },
      },
    ]),
  );
  assert.equal(result.ok, true);
});

test("rejects a document whose root content is not an array", () => {
  const result = validate({ content: [], root: { props: { content: "not-an-array" } } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /must be an array/);
});

test("rejects excessive nesting depth", () => {
  let content: unknown = [];
  for (let i = 0; i < 20; i++) {
    content = [{ type: "Section", props: { id: `s${i}`, padding: "none", content } }];
  }
  const result = validate(doc(content as unknown[]));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /nesting/);
});
