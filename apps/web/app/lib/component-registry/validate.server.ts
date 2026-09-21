/**
 * Server-side validation for a Puck document before it's ever written to
 * `pages.draft_document`. A TypeScript type on the client is not
 * validation — this walks the actual JSON, checking it against the
 * caller's component config (so it stays correct as components are
 * added, with no separate allowlist to fall out of sync): known
 * component types only, a bounded nesting depth, and a size cap on the
 * raw input.
 *
 * It also builds a SANITIZED PROJECTION rather than merely accepting or
 * rejecting: any prop key not declared in that component's `fields` is
 * DROPPED, not persisted and not treated as an error. This matters
 * because Puck's `resolveData` (see component-registry/config.tsx's
 * ProductGrid) merges extra, non-field props like `resolvedProducts`
 * directly into a component's `props` for rendering — confirmed with a
 * real browser session (Playwright), not assumed: the actual autosave
 * request Puck's editor sent included `resolvedProducts`,
 * `resolvedCurrency`, `resolvedError` inside `ProductGrid.props`. The
 * previous version of this validator rejected the entire save as
 * "unexpected prop", silently breaking every autosave on a page
 * containing a ProductGrid. Stripping (not accepting-and-persisting)
 * those keys fixes that while still refusing to ever store transient,
 * server-resolved commerce data in the CMS's own document — on the next
 * read, resolveAllData recomputes it fresh from live Medusa data either
 * way, so persisting a stale copy would only be wrong, never useful.
 */

const MAX_INPUT_BYTES = 500_000; // generous: real resolved product data (images, prices) inflates this well beyond the authored-only size
const MAX_PERSISTED_BYTES = 200_000; // the sanitized, authored-only projection actually written to draft_document
const MAX_NESTING_DEPTH = 12;

export type FieldSchema = { type: string };
export type ComponentSchema = { fields?: Record<string, FieldSchema> };
export type ValidatableConfig = { components?: Record<string, ComponentSchema> };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type ValidationResult<T = unknown> = { ok: true; document: T } | { ok: false; error: string };

export function validatePuckDocument<T = unknown>(doc: unknown, config: ValidatableConfig): ValidationResult<T> {
  let inputSize: number;
  try {
    inputSize = JSON.stringify(doc)?.length ?? 0;
  } catch {
    return { ok: false, error: "Document is not serializable." };
  }
  if (inputSize > MAX_INPUT_BYTES) {
    return { ok: false, error: `Document too large (${inputSize} bytes, max ${MAX_INPUT_BYTES}).` };
  }

  if (!isPlainObject(doc)) return { ok: false, error: "Document must be an object." };
  if (!isPlainObject(doc.root)) return { ok: false, error: "Document root must be an object." };
  const rootProps = isPlainObject(doc.root.props) ? doc.root.props : doc.root;
  const rootContent = rootProps.content;
  if (!Array.isArray(rootContent)) return { ok: false, error: "Document root content must be an array." };

  const components = config.components ?? {};
  const knownTypes = new Set(Object.keys(components));

  function sanitizeNodes(nodes: unknown[], depth: number): { ok: true; nodes: unknown[] } | { ok: false; error: string } {
    if (depth > MAX_NESTING_DEPTH) return { ok: false, error: "Document nesting is too deep." };

    const sanitized: unknown[] = [];

    for (const node of nodes) {
      if (!isPlainObject(node)) return { ok: false, error: "Each component must be an object." };

      const type = node.type;
      if (typeof type !== "string" || !knownTypes.has(type)) {
        return { ok: false, error: `Unknown component type: ${String(type)}.` };
      }

      const props = node.props;
      if (!isPlainObject(props)) return { ok: false, error: `Component "${type}" is missing props.` };
      if (typeof props.id !== "string" || props.id.length === 0) {
        return { ok: false, error: `Component "${type}" is missing an id.` };
      }

      const fieldDef = components[type]?.fields ?? {};
      const sanitizedProps: Record<string, unknown> = { id: props.id };

      for (const [key, def] of Object.entries(fieldDef)) {
        if (!(key in props)) continue; // field has no value yet (e.g. not set) — fine, Puck applies defaultProps
        const value = props[key];

        if (def.type === "slot") {
          if (!Array.isArray(value)) {
            return { ok: false, error: `Slot "${key}" on "${type}" must be an array.` };
          }
          const nested = sanitizeNodes(value, depth + 1);
          if (!nested.ok) return nested;
          sanitizedProps[key] = nested.nodes;
        } else {
          // Authored field values are trusted as-is beyond basic
          // shape (string/number/slot) — Puck's own field UI already
          // constrains e.g. select options client-side, and none of
          // these fields currently reach raw HTML/SQL/exec contexts.
          sanitizedProps[key] = value;
        }
      }
      // Any prop NOT in fieldDef (e.g. ProductGrid's resolvedProducts) is
      // simply absent from sanitizedProps — dropped, not carried through.

      sanitized.push({ type, props: sanitizedProps });
    }

    return { ok: true, nodes: sanitized };
  }

  const sanitizedRoot = sanitizeNodes(rootContent, 0);
  if (!sanitizedRoot.ok) return sanitizedRoot;

  const sanitizedDocument = {
    content: [],
    root: { props: { ...rootProps, content: sanitizedRoot.nodes } },
  };

  const persistedSize = JSON.stringify(sanitizedDocument).length;
  if (persistedSize > MAX_PERSISTED_BYTES) {
    return { ok: false, error: `Document too large after sanitizing (${persistedSize} bytes, max ${MAX_PERSISTED_BYTES}).` };
  }

  return { ok: true, document: sanitizedDocument as T };
}
