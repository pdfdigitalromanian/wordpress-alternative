/** The hand-drawn site previews from digital-romanian-screens.html, i.e. the
 *  `.t-*` rules in digital-romanian.css. */
export const SITE_THEMES = ["alicia", "nova", "axis", "sun"] as const;

export type SiteTheme = (typeof SITE_THEMES)[number] | "plain";

/**
 * Sites carry no screenshot, so the grid falls back to the prototype's drawn
 * previews.
 *
 * A site made with the "Create new site" button keeps the reference's brand new
 * look: digital-romanian-screens.html line 1897 gives it `theme: 'plain'` and
 * the "Untitled site" name, so that is what a fresh card shows.
 *
 * Everything else is dealt the pretty previews in rotation rather than at
 * random, so two or three neighbouring cards never end up with the same one.
 * `index` counts only those sites, which keeps the rotation gap-free around the
 * plain ones. It is the site's position in the loader's stable (created_at)
 * order, so the assignment is identical on the server and the client and from
 * one reload to the next -- Math.random() here would change the markup between
 * the two and trip a hydration mismatch.
 *
 * When sites do get real thumbnails, prefer that image at the call site and
 * this becomes the fallback for sites that still have none.
 */
export function themeForSite(index: number, name: string): SiteTheme {
  if (/^untitled site/i.test(name.trim())) return "plain";
  return SITE_THEMES[index % SITE_THEMES.length];
}
