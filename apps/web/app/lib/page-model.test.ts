import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePagePath, pageStatus, safeLink } from "./page-model.ts";

test("page paths preserve home and reject commerce, internal, and nested routes", () => {
  assert.deepEqual(validatePagePath("/"), { slug: "" });
  assert.deepEqual(validatePagePath(" /About-Us/ "), { slug: "about-us" });
  for (const path of ["shop", "/admin/", "checkout", "api", "products", "foo/bar", "bad path"]) assert.ok(validatePagePath(path).error, path);
});
test("publication comparison uses content, title and route, not JSON key order", () => {
  const draft = { id: "p1", title: "Home", slug: "", draft_document: { b: 2, a: 1 } };
  const live = [{ page_id: "p1", title: "Home", slug: "", document: { a: 1, b: 2 } }];
  assert.equal(pageStatus(draft, live), "Live");
  assert.equal(pageStatus({ ...draft, slug: "about" }, live), "Unpublished changes");
  assert.equal(pageStatus({ ...draft, title: "Changed" }, live), "Unpublished changes");
  assert.equal(pageStatus({ ...draft, draft_document: { a: 3 } }, live), "Unpublished changes");
  assert.equal(pageStatus(draft, []), "New page");
});
test("authored links block executable and protocol-relative destinations", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,bad", "//evil.test", "\\\\evil.test"]) assert.equal(safeLink(value), "#");
  for (const value of ["/shop", "#contact", "https://example.com", "mailto:hello@example.com"]) assert.equal(safeLink(value), value);
});
