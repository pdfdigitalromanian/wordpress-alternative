/* digital-romanian-screens.html line 1459, verbatim:

     const slugify = s => (s || '').toLowerCase().normalize('NFD')
       .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
       .replace(/^-+|-+$/g, '').slice(0, 40);

   Shared by the onboarding form, the create-workspace dialog and the server
   action, so the three can't drift.

   It lives in a plain module rather than workspace-actions.server.ts because the
   dialog is a client component: importing a *value* out of a `.server` module
   drags it into the client bundle, which the React Router Vite plugin rejects,
   and the route then renders on the server but never hydrates — every button,
   including "Create new workspace", silently does nothing. */
export function slugify(value: string) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/* The manual-slug normaliser, digital-romanian-screens.html line 1719. Editing
   the field is not the same operation as deriving a slug from the name: it
   keeps existing hyphens and only collapses runs of them. */
export function normalizeSlugField(value: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-");
}
