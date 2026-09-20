import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePuckDocument, type ValidatableConfig } from "./validate.server.ts";

// Mirrors the shape of the real componentConfig.tsx (Section/Heading/
// Text/Button) without importing it — that file has JSX, which Node's
// native TS runner used to execute this test cannot load.
const testConfig: ValidatableConfig = {
  components: {
    Section: { fields: { content: { type: "slot" }, padding: { type: "select" } } },
    Heading: { fields: { text: { type: "text" }, level: { type: "select" } } },
    Text: { fields: { text: { type: "textarea" } } },
    Button: { fields: { label: { type: "text" }, href: { type: "text" } } },
  },
};

function doc(content: unknown[]) {
  return { content: [], root: { props: { content } } };
}

function validate(document: unknown) {
  return validatePuckDocument(document, testConfig);
}

test("accepts an empty document", () => {
  assert.equal(validate(doc([])).ok, true);
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

test("rejects an unexpected prop not declared in the component's fields", () => {
  const result = validate(doc([{ type: "Heading", props: { id: "h1", text: "Hi", level: "h1", onClick: "alert(1)" } }]));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /unexpected prop/);
});

test("rejects a component missing an id", () => {
  const result = validate(doc([{ type: "Heading", props: { text: "Hi", level: "h1" } }]));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /missing an id/);
});

test("recurses into a valid slot", () => {
  const result = validate(
    doc([
      {
        type: "Section",
        props: { id: "s1", padding: "medium", content: [{ type: "Text", props: { id: "t1", text: "hi" } }] },
      },
    ]),
  );
  assert.equal(result.ok, true);
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

test("rejects a document over the size cap", () => {
  const hugeText = "x".repeat(250_000);
  const result = validate(doc([{ type: "Text", props: { id: "t1", text: hugeText } }]));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /too large/);
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
