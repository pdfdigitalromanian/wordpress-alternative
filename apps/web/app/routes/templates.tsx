import { useEffect, useMemo, useState } from "react";
import { Toast } from "~/components/workspace-dialogs";
import { StatTile, TemplateThumb, TYPE_LABEL, TPL_DESC } from "~/lib/workspace-views";
import { timeAgo } from "~/lib/workspace-view";

/* renderTemplates() / renderTplBody(), from digital-romanian-screens.html
   lines 2103-2176, with the prototype's own demoLibrary().

   The template library is kept as the file keeps it: nine hardcoded templates
   (demoLibrary(), line 2064) and five hardcoded component counts (line 2079),
   present so the screen has something to lay out - the schema has no templates
   table (workspaces, workspace_memberships, sites, site_domains, pages,
   releases, commerce_connections) and this port adds no migration.

   The "Create template" button therefore does what the file's [data-new-tpl]
   handler does (line 2336): it adds an "Untitled template" item to the list in
   memory and toasts. It deliberately does NOT navigate anywhere - creating a
   template is an editor action, not a jump to the overview.

   Everything else the prototype wires against that array - the four tabs, the
   search box, the "View all" toggle, the per-card more-menu (Use in a site /
   Duplicate / Delete) - is handled here against local state. When a templates
   table is added later, this page can seed from it instead; the markup below
   does not change. */

const icon = (id: string, w = 16, h = w, vb = `0 0 ${w} ${h}`) => (
  <svg width={w} height={h} viewBox={vb} fill="none" aria-hidden="true">
    <use href={`#${id}`} />
  </svg>
);

export type LibraryItem = {
  id: string;
  name: string;
  type: "section" | "global";
  kind: string;
  uses: number;
  updated: number;
  used: number;
};

const DAY = 864e5;
const RECENT_WINDOW = 14 * DAY;

/* demoLibrary()'s items (lines 2068-2078), seeded relative to "now" the same
   way the standalone file does, just once on mount. */
function seedItems(): LibraryItem[] {
  const t = Date.now();
  const item = (
    id: string,
    name: string,
    type: "section" | "global",
    kind: string,
    uses: number,
    updated: number,
    used: number,
  ): LibraryItem => ({ id, name, type, kind, uses, updated: t - updated * DAY, used: t - used * DAY });
  return [
    item("t1", "Hero section", "section", "hero", 42, 3, 1),
    item("t2", "Features row", "section", "features", 37, 5, 2),
    item("t3", "CTA block", "section", "cta", 31, 7, 3),
    item("t4", "Testimonial", "section", "testimonial", 28, 7, 6),
    item("t5", "Pricing table", "section", "pricing", 14, 12, 20),
    item("t6", "Contact form", "section", "form", 11, 16, 9),
    item("t7", "Footer", "section", "footer", 9, 21, 30),
    item("t8", "Landing page", "global", "page", 19, 4, 4),
    item("t9", "Shop home", "global", "shop", 6, 25, 40),
  ];
}

const MAX_SHOWN = 4;

/* The five component tiles, from demoLibrary()'s components array (lines
   2079-2085) - names, counts and tint verbatim from the file. */
const COMPONENT_GROUPS = [
  {
    name: "Buttons",
    n: 12,
    tint: "#dcefe2",
    path: <rect x="2.5" y="5" width="11" height="6" rx="3" stroke="currentColor" strokeWidth="1.4" />,
  },
  {
    name: "Forms",
    n: 8,
    tint: "#e8e0f3",
    path: (
      <>
        <rect x="3" y="2.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 6h5M5.5 9h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
  },
  {
    name: "Navigations",
    n: 6,
    tint: "#f3e4d4",
    path: <path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
  },
  {
    name: "Cards",
    n: 10,
    tint: "#f6dcd6",
    path: (
      <>
        <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2.5 7h11" stroke="currentColor" strokeWidth="1.4" />
      </>
    ),
  },
  {
    name: "Modals",
    n: 4,
    tint: "#dfe8f7",
    path: (
      <>
        <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <rect x="5" y="5.5" width="6" height="5" rx="1" fill="currentColor" />
      </>
    ),
  },
];

type TabKey = "all" | "section" | "components" | "global" | "recent";

const TABS: [TabKey, string][] = [
  ["all", "All"],
  ["section", "Sections"],
  ["components", "Components"],
  ["global", "Global templates"],
];

const HEADS: Record<TabKey, [string, string]> = {
  all: ["Featured templates", "Most popular and recently used templates across your workspace."],
  section: ["Sections", "Reusable page sections you can drop into any site."],
  global: ["Global templates", "Full page templates shared by every site in this workspace."],
  recent: ["Recently used", "Templates used in the last two weeks."],
  components: ["Global components", "Reusable UI components available across all sites."],
};

export default function WorkspaceTemplates() {
  const [items, setItems] = useState<LibraryItem[]>(() => seedItems());
  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; label?: string; href?: string } | null>(null);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 5200);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const now = Date.now();
  const sections = items.filter((i) => i.type === "section").length;
  const globals = items.filter((i) => i.type === "global").length;
  const recent = items.filter((i) => now - i.used < RECENT_WINDOW).length;
  const compTotal = COMPONENT_GROUPS.reduce((a, c) => a + c.n, 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter(
        (i) =>
          (tab === "all" || tab === i.type || (tab === "recent" && now - i.used < RECENT_WINDOW)) &&
          (!q || i.name.toLowerCase().includes(q)),
      )
      .sort((a, b) => (tab === "recent" ? b.used - a.used : b.uses - a.uses));
  }, [items, tab, query, now]);

  const shown = showAll || query || !filtered.length ? filtered : filtered.slice(0, MAX_SHOWN);
  const comps = COMPONENT_GROUPS.filter((c) => !query.trim() || c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const showTpls = tab !== "components";
  const showComps = tab === "all" || tab === "components";
  const [heading, subheading] = HEADS[tab] ?? HEADS.all;

  const selectTab = (key: TabKey) => {
    // A stat tile toggles back to "all" when it is already the active filter
    // (line 2333), which is why the tile and the tab share one handler.
    setTab((current) => (current === key ? "all" : key));
    setShowAll(false);
  };

  const createTemplate = () => {
    const n = items.filter((i) => i.name.startsWith("Untitled template")).length;
    const name = n ? `Untitled template ${n + 1}` : "Untitled template";
    const at = Date.now();
    // [data-new-tpl]: push a fresh section, show every item, and toast.
    setItems((list) => [...list, { id: `tpl-${at}`, name, type: "section", kind: "plain", uses: 0, updated: at, used: at }]);
    setTab("all");
    setQuery("");
    setShowAll(true);
    setToastMsg({ text: `${name} created` });
  };

  const duplicate = (item: LibraryItem) => {
    const at = Date.now();
    setItems((list) => [...list, { ...item, id: `tpl-${at}`, name: `${item.name} copy`, uses: 0, updated: at }]);
    setOpenMenu(null);
    setToastMsg({ text: `${item.name} duplicated` });
  };

  const remove = (item: LibraryItem) => {
    setItems((list) => list.filter((i) => i.id !== item.id));
    setOpenMenu(null);
    setToastMsg({ text: `${item.name} deleted` });
  };

  const useInSite = (item: LibraryItem) => {
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, uses: i.uses + 1, used: Date.now() } : i)));
    setOpenMenu(null);
    // [data-tpl-use]: the toast carries an "Open site" shortcut to #/overview;
    // it does not navigate the shell away on its own.
    setToastMsg({ text: `Open a site to add ${item.name}`, label: "Open site", href: "/overview" });
  };

  return (
    <>
      <div className="wsd-head">
        <div>
          <p className="eyebrow">Template</p>
          <h1 tabIndex={-1}>Library</h1>
          <p>Reusable sections and global component templates shared across all sites in this workspace.</p>
        </div>
        <div className="wsd-tools">
          <div className="search-box">
            {icon("i-search")}
            <label className="sr-only" htmlFor="tpl-search">
              Search templates
            </label>
            <input
              id="tpl-search"
              type="search"
              placeholder="Search templates"
              value={query}
              autoComplete="off"
              onChange={(e) => {
                setQuery(e.currentTarget.value);
                setShowAll(false);
              }}
            />
          </div>
          <button type="button" className="btn-dark" onClick={createTemplate}>
            {icon("i-plus", 18)}
            <span>
              Create <span className="long">template</span>
            </span>
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Template types">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => selectTab(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="stats c4">
        <StatTile
          label="Sections"
          value={sections}
          active={tab === "section"}
          onClick={() => selectTab("section")}
          icon={
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3.5h10M3 8h10M3 12.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          }
        />
        <StatTile
          label="Components"
          value={compTotal}
          active={tab === "components"}
          onClick={() => selectTab("components")}
          icon={
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="4" cy="11.5" r="2" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="12" cy="11.5" r="2" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          }
        />
        <StatTile
          label="Global templates"
          value={globals}
          active={tab === "global"}
          tint="#dfe8f7"
          onClick={() => selectTab("global")}
          icon={
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 2.5h5.5L12 5v8.5H4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M6 8h4M6 10.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          }
        />
        <StatTile
          label="Recently used"
          value={recent}
          active={tab === "recent"}
          tint="#fbe7c6"
          onClick={() => selectTab("recent")}
          icon={
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 2.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 10.7l-3.2 1.7.6-3.6L2.8 6.3l3.6-.5z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          }
        />
      </div>

      <div id="tpl-body">
        {showTpls ? (
          items.length ? (
            <>
              <div className="sec-head">
                <div>
                  <h2>{heading}</h2>
                  <p>{subheading}</p>
                </div>
                {filtered.length > MAX_SHOWN && !query ? (
                  <button
                    type="button"
                    className="link-more"
                    aria-label={showAll ? "Show less templates" : "View all templates"}
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll ? "Show less" : "View all"}
                    {icon("i-arrow-right")}
                  </button>
                ) : null}
              </div>
              <div className="tpls">
                {shown.map((item) => (
                  <article className="tpl" key={item.id}>
                    <TemplateThumb kind={item.kind} />
                    <div className="tpl-head">
                      <h3>{item.name}</h3>
                      <span className="tag">{TYPE_LABEL[item.type]}</span>
                    </div>
                    <p>{TPL_DESC[item.kind] || TPL_DESC.plain}</p>
                    <div className="site-foot">
                      <span>Updated {timeAgo(item.updated).toLowerCase()}</span>
                      <span className="menu-cell">
                        <button
                          type="button"
                          className="more-btn"
                          aria-label={`More actions for ${item.name}`}
                          aria-expanded={openMenu === item.id}
                          onClick={() => setOpenMenu((m) => (m === item.id ? null : item.id))}
                        >
                          {icon("i-more")}
                        </button>
                        <div className="more-menu" hidden={openMenu !== item.id}>
                          <button type="button" onClick={() => useInSite(item)}>
                            Use in a site
                          </button>
                          <button type="button" onClick={() => duplicate(item)}>
                            Duplicate
                          </button>
                          <hr />
                          <button type="button" className="danger" onClick={() => remove(item)}>
                            Delete
                          </button>
                        </div>
                      </span>
                    </div>
                  </article>
                ))}
                {!shown.length ? (
                  <p className="empty-inline">
                    No templates match.{" "}
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => {
                        setQuery("");
                        setTab("all");
                      }}
                    >
                      Show all templates
                    </button>
                  </p>
                ) : null}
              </div>
            </>
          ) : null
        ) : null}

        {showComps && COMPONENT_GROUPS.length ? (
          <>
            <div className="sec-head">
              <div>
                <h2>Global components</h2>
                <p>Reusable UI components available across all sites.</p>
              </div>
              {tab === "all" ? (
                <button type="button" className="link-more" aria-label="View all components" onClick={() => setTab("components")}>
                  View all
                  {icon("i-arrow-right")}
                </button>
              ) : null}
            </div>
            <div className="comps">
              {comps.map((c) => (
                <button
                  type="button"
                  className="comp"
                  key={c.name}
                  onClick={() => {
                    if (tab !== "components") setTab("components");
                    else setToastMsg({ text: `${c.name}: component browser coming soon` });
                  }}
                >
                  <span className="ic" style={{ "--tc": c.tint } as React.CSSProperties}>
                    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      {c.path}
                    </svg>
                  </span>
                  <span className="txt">
                    <small>{c.name}</small>
                    <strong>{c.n}</strong>
                  </span>
                  {icon("i-chevron-right", 18, 17)}
                </button>
              ))}
              {!comps.length ? <p className="empty-inline">No components match.</p> : null}
            </div>
          </>
        ) : null}
      </div>

      {toastMsg ? (
        <Toast
          text={toastMsg.text}
          {...(toastMsg.label
            ? {
                link: {
                  label: toastMsg.label,
                  onClick: () => {
                    setToastMsg(null);
                    if (toastMsg.href) window.location.assign(toastMsg.href);
                  },
                },
              }
            : {})}
        />
      ) : null}
    </>
  );
}