export const reservedPaths = new Set(["admin", "login", "logout", "shop", "products", "cart", "checkout", "api"]);

export function validatePagePath(value: string): { slug: string; error?: string } {
  const slug = value.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  if (reservedPaths.has(slug)) return { slug, error: "This path is reserved by the application. Choose another path." };
  if (slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { slug, error: "Use lowercase letters, numbers, and hyphens. Leave blank for the home page." };
  return { slug };
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${JSON.stringify(key)}:${canonical(val)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

export type DraftPage = { id: string; title: string; slug: string; draft_document: unknown };
export type ReleasedPage = { page_id: string | null; title: string; slug: string; document: unknown };
export function pageStatus(page: DraftPage, published: ReleasedPage[]) {
  const live = published.find((item) => item.page_id === page.id);
  if (!live) return "New page";
  if (page.title !== live.title || page.slug !== live.slug || canonical(page.draft_document) !== canonical(live.document)) return "Unpublished changes";
  return "Live";
}

export function safeLink(value: string): string {
  const href = value.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href) || /^(\/(?!\/)|#)/.test(href)) return href;
  return "#";
}
