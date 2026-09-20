/**
 * Server-side validation for a Puck document before it's ever written to
 * `pages.draft_document`. A TypeScript type on the client is not
 * validation — this walks the actual JSON, checking it against the
 * caller's component config (so it stays correct as components are
 * added, with no separate allowlist to fall out of sync): known
 * component types only, no props beyond what that component's own field
 * definitions declare, slot values are arrays, bounded nesting depth,
 * and a total size cap.
 *
 * Takes the config as a parameter rather than importing
 * `component-registry/config.tsx` directly: that file contains JSX
 * (component render functions), which Node's native TS runner
 * (`--experimental-strip-types`, used to run this file's own tests)
 * cannot load — `.tsx` has no built-in loader. Decoupling the validator
 * from the render layer this way is also just better separation of
 * concerns, independent of the test-runner constraint.
 */

const MAX_DOCUMENT_BYTES = 200_000;
const MAX_NESTING_DEPTH = 12;

export type FieldSchema = { type: string };
export type ComponentSchema = { fields?: Record<string, FieldSchema> };
export type ValidatableConfig = { components?: Record<string, ComponentSchema> };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validatePuckDocument(doc: unknown, config: ValidatableConfig): ValidationResult {
  let serialized: string;
  try {
    serialized = JSON.stringify(doc) ?? "";
  } catch {
    return { ok: false, error: "Document is not serializable." };
  }
  if (serialized.length > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: `Document too large (${serialized.length} bytes, max ${MAX_DOCUMENT_BYTES}).` };
  }

  if (!isPlainObject(doc)) return { ok: false, error: "Document must be an object." };
  if (!isPlainObject(doc.root)) return { ok: false, error: "Document root must be an object." };
  const rootProps = isPlainObject(doc.root.props) ? doc.root.props : doc.root;
  const rootContent = rootProps.content;
  if (!Array.isArray(rootContent)) return { ok: false, error: "Document root content must be an array." };

  const components = config.components ?? {};
  const knownTypes = new Set(Object.keys(components));

  function walk(nodes: unknown[], depth: number): ValidationResult {
    if (depth > MAX_NESTING_DEPTH) return { ok: false, error: "Document nesting is too deep." };

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
      const allowedKeys = new Set(["id", ...Object.keys(fieldDef)]);
      for (const key of Object.keys(props)) {
        if (!allowedKeys.has(key)) {
          return { ok: false, error: `Component "${type}" has an unexpected prop: "${key}".` };
        }
      }

      for (const [key, def] of Object.entries(fieldDef)) {
        if (def.type === "slot" && props[key] !== undefined) {
          const slotValue = props[key];
          if (!Array.isArray(slotValue)) {
            return { ok: false, error: `Slot "${key}" on "${type}" must be an array.` };
          }
          const nested = walk(slotValue, depth + 1);
          if (!nested.ok) return nested;
        }
      }
    }

    return { ok: true };
  }

  return walk(rootContent, 0);
}
