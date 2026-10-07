/* Shared vocabulary for the three workspace views ported from
   digital-romanian-screens.html (Library / Team / General settings).

   Everything here is presentation that the prototype defines as constants or
   small helpers, lifted verbatim so the three route modules and the account
   menu all read them from one place:

     ROLES / TYPE_LABEL / TPL_DESC  line 1715 / 2063 / 2051
     ROLE_TINT / ROLE_ICON          line 2181 / 2182
     TINTS / tint()                 line 1736 / 1737
     thumbHTML()                    line 2090
     timeAgo()                      its own module (workspace-view.ts)

   The demo *data* those constants decorate is deliberately not reproduced -
   see each route's comment on where its rows come from instead. */

/** The three storable workspace roles, with the prototype's own wording. The
 *  database enum is owner | administrator | editor | viewer; the two extra
 *  enum values have no prototype counterpart here because nothing writes them
 *  yet (see workspace-actions.server.ts ROLE_FOR_DB). */
export const ROLES = {
  owner: { label: "Owner", access: "Full control of the workspace, billing and every site." },
  admin: { label: "Admin", access: "Can manage billing, the team and all sites in the workspace." },
  contributor: {
    label: "Contributor",
    access: "Can only access the sites they're given. Can't manage billing or the team.",
  },
} as const;

export type RoleKey = keyof typeof ROLES;

export const ROLE_TINT: Record<RoleKey, string> = {
  owner: "#f1efe8",
  admin: "#f3e4d4",
  contributor: "#f6dcd6",
};

/** How a stored database role is labelled in the Team table (line 2233). */
export function roleLabel(role: string) {
  if (role === "owner") return "Workspace owner";
  if (role === "admin" || role === "administrator") return "Admin";
  if (role === "contributor" || role === "editor" || role === "author") return "Site contributor";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function RoleIcon({ role }: { role: string }) {
  if (role === "owner") {
    return (
      <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M2.5 5l2.8 2.3L8 3.5l2.7 3.8L13.5 5l-1.2 7H3.7z" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    );
  }
  if (role === "admin" || role === "administrator") {
    return (
      <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2l5 2v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4z" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={11} height={11} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <use href="#i-pencil" />
    </svg>
  );
}

export function RolePill({ role }: { role: string }) {
  const tint = role === "admin" || role === "administrator" ? ROLE_TINT.admin : ROLE_TINT[role as RoleKey] ?? "var(--soft)";
  return (
    <span className="rpill" style={{ "--tc": tint } as React.CSSProperties}>
      <RoleIcon role={role} />
      {roleLabel(role)}
    </span>
  );
}

export const TINTS = ["#dfe8f7", "#dcefe2", "#f3e4d4", "#e8e0f3", "#f6dcd6", "#d9eeee"];

/** tint(str), line 1737: a stable colour from a string, so the same person's
 *  avatar keeps the same tint between renders and between pages. */
export function tint(seed: string | undefined) {
  const s = seed ?? "";
  const sum = [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
  return TINTS[sum % TINTS.length];
}

export function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/* The nine drawn template thumbnails, from thumbHTML() at line 2090. They are
   pure CSS marks (no images) and are reproduced as elements so the Library
   cards look like the design without shipping a screenshot per template. */

const ln = (width: number, cls = "") => <span className={`ln ${cls}`} style={{ width: `${width}%` }} />;

function ThumbHero() {
  return (
    <>
      <span className="col" style={{ flex: 1.1 }}>
        {ln(90, "h")}
        {ln(70, "h")}
        {ln(80)}
        <span className="btnx" />
      </span>
      <span className="bx" style={{ flex: 1 }} />
    </>
  );
}

function ThumbFeatures() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <span className="col" key={i} style={{ flex: 1, alignItems: "center" }}>
          <span className="dot" />
          {ln(80)}
          {ln(60)}
        </span>
      ))}
    </>
  );
}

function ThumbCta() {
  return (
    <>
      <span className="col" style={{ flex: 1.1 }}>
        {ln(85, "h")}
        {ln(70)}
        {ln(55)}
        <span className="btnx" />
      </span>
      <span className="bx" style={{ flex: 1 }} />
    </>
  );
}

function ThumbTestimonial() {
  return (
    <span className="col" style={{ flex: 1 }}>
      {ln(95)}
      {ln(85)}
      {ln(70)}
      <span style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
        <span className="dot" style={{ width: 12, height: 12 }} />
        {ln(40)}
      </span>
    </span>
  );
}

function ThumbPricing() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <span
          className="col"
          key={i}
          style={{
            flex: 1,
            padding: 5,
            borderRadius: 3,
            background: i === 1 ? "#16305f" : "#fff",
            color: i === 1 ? "#fff" : "#16305f",
          }}
        >
          {ln(60)}
          {ln(40, "h")}
          {ln(80)}
          {ln(70)}
        </span>
      ))}
    </>
  );
}

function ThumbForm() {
  return (
    <span className="col" style={{ flex: 1 }}>
      {ln(45, "h")}
      <span className="bx" style={{ height: 9, background: "#fff", border: "1px solid #ccc" }} />
      <span className="bx" style={{ height: 9, background: "#fff", border: "1px solid #ccc" }} />
      <span className="btnx" />
    </span>
  );
}

function ThumbFooter() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <span className="col" key={i} style={{ flex: 1 }}>
          {ln(70, "h")}
          {ln(90)}
          {ln(60)}
          {ln(75)}
        </span>
      ))}
    </>
  );
}

function ThumbPage() {
  return (
    <span className="col" style={{ flex: 1, justifyContent: "flex-start", gap: 5 }}>
      {ln(100)}
      <span className="bx" style={{ height: 20 }} />
      <span style={{ display: "flex", gap: 4 }}>
        <span className="bx" style={{ flex: 1, height: 12, background: "#d7e1f2" }} />
        <span className="bx" style={{ flex: 1, height: 12, background: "#d7e1f2" }} />
        <span className="bx" style={{ flex: 1, height: 12, background: "#d7e1f2" }} />
      </span>
    </span>
  );
}

function ThumbShop() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <span className="col" key={i} style={{ flex: 1 }}>
          <span className="bx" style={{ height: 26 }} />
          {ln(80)}
          {ln(50)}
        </span>
      ))}
    </>
  );
}

export function TemplateThumb({ kind }: { kind: string }) {
  return (
    <span className={`tt k-${kind}`}>
      {kind === "hero" ? <ThumbHero /> : null}
      {kind === "features" ? <ThumbFeatures /> : null}
      {kind === "cta" ? <ThumbCta /> : null}
      {kind === "testimonial" ? <ThumbTestimonial /> : null}
      {kind === "pricing" ? <ThumbPricing /> : null}
      {kind === "form" ? <ThumbForm /> : null}
      {kind === "footer" ? <ThumbFooter /> : null}
      {kind === "page" ? <ThumbPage /> : null}
      {kind === "shop" ? <ThumbShop /> : null}
      {kind === "plain" ? <span className="col" style={{ flex: 1 }}>{ln(70, "h")}</span> : null}
    </span>
  );
}

/** TPL_DESC, line 2051. */
export const TPL_DESC: Record<string, string> = {
  hero: "Clean hero section with headline, subtext and CTA button.",
  features: "Three column features with icons, title and short description.",
  cta: "Call to action section with title, description and button.",
  testimonial: "Customer testimonial with avatar, quote and author details.",
  pricing: "Three pricing plans with a highlighted recommended plan.",
  form: "Contact form with name, email, message and a send button.",
  footer: "Four column footer with links, contact details and socials.",
  page: "Full landing page: navigation, hero, features and footer.",
  shop: "Shop home with featured products and a promo banner.",
  plain: "An empty template. Open a site and save a section into it.",
};

/** TYPE_LABEL, line 2063. */
export const TYPE_LABEL: Record<string, string> = {
  section: "Section",
  global: "Global template",
};

/** The .stat tile shared by Library and Team (lines 2109-2110 and 2196-2197):
 *  a tinted icon, a label, a count and a chevron, as a toggle button. */
export function StatTile({
  label,
  value,
  active,
  tint: tileTint = "#f5f4ef",
  onClick,
  icon,
  children,
}: {
  label: string;
  value: number;
  active?: boolean;
  tint?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <span className="ic tint" style={{ "--tc": tileTint } as React.CSSProperties}>
        {icon}
      </span>
      <span className="txt">
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
      <svg width={18} height={17} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <use href="#i-chevron-right" />
      </svg>
    </>
  );
  if (!onClick) return <div className="stat">{body}</div>;
  return (
    <button type="button" className="stat" aria-pressed={active} onClick={onClick}>
      {body}
    </button>
  );
}

/** siteAccess(), line 2187: the "Assigned sites" cell, worded as the
 *  prototype words it. access === "all" is the only value produced today,
 *  because workspace_memberships has no per-site access column yet. */
export function siteAccessText(access: "all" | "some", siteNames: string[]) {
  if (access === "all") return "All sites (full access)";
  if (!siteNames.length) return "No sites";
  return `${siteNames.length} ${siteNames.length === 1 ? "site" : "sites"} (${siteNames.join(", ")})`;
}