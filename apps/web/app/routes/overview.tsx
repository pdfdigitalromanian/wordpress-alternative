import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useActionData, useLocation, useNavigate, useRouteLoaderData } from "react-router";
import { AccountMenu } from "~/components/account-menu";
import {
  CategoriesView,
  generateCategories,
  generateOrders,
  generatePages,
  generateProducts,
  OrdersView,
  ProductsView,
  WebsitePagesView,
  type Category,
  type Order,
  type Product,
  type WebPage,
} from "~/components/overview-screens";
import { CreateWorkspaceDialog, InviteDialog, Toast } from "~/components/workspace-dialogs";
import { useResultToast } from "~/components/workspace-shell";
import { Wmark } from "~/components/workspace-sidebar";
import { handleWorkspaceAction } from "~/lib/workspace-actions.server";
import { slugify } from "~/lib/slugify";
import { timeAgo } from "~/lib/workspace-view";
import "./overview.css";
import type { Route } from "./+types/overview";
import type { loader as workspaceDataLoader } from "./workspace-data";

/* The /overview screen from digital-romanian-screen.html (section
   data-route="/overview", nested). One route component serves the three
   views the standalone file paints there — Overview, Website Pages
   (#/overview/pages) and E-Commerce / Store → Products
   (#/overview/products) — picked from the pathname. Markup, icon sizes and
   colours mirror the prototype's static HTML + renderSiteOverview() /
   renderPagesView() / renderProductsView() one-for-one; overview.css carries
   every rule the prototype applies to this section, including the
   [data-route="/overview"] Figma pixel-match block and the site-screen
   block. The demo WORKSPACES / SITES arrays are replaced by the signed-in
   user's real rows. */

export async function action({ request }: Route.ActionArgs) {
  return handleWorkspaceAction(request, await request.formData());
}

/* #i-dr-logo from the sprite, drawn the same 40x32 as the prototype. */
const DR_LOGO = (
  <svg className="dr-logo" width="40" height="32" viewBox="0 0 40 32" fill="none" aria-hidden="true">
    <use href="#i-dr-logo" />
  </svg>
);

/* The <use> helper the prototype uses for every sprite glyph. */
const icon = (id: string, w = 16, h = w, vb = `0 0 ${w} ${h}`, className?: string) => (
  <svg className={className} width={w} height={h} viewBox={vb} fill="none" aria-hidden="true">
    <use href={`#${id}`} />
  </svg>
);

/* Sidebar glyphs the prototype draws inline, stroke-for-stroke. */
const OVERVIEW_ICON = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M2.75 7.4 9 2.5l6.25 4.9v7.35a.75.75 0 0 1-.75.75h-3.25v-4.75h-4.5v4.75H3.5a.75.75 0 0 1-.75-.75z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
const CMS_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M5 5.5h6M5 8h6M5 10.5h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
/* The sidebar's media row draws #i-media at 21x16; the .ic-media rule in
   overview.css shrinks it to 18x14, exactly as in the prototype. */
const MEDIA_ICON = (
  <svg className="ic-media" width="21" height="16" viewBox="0 0 21 16" fill="none" aria-hidden="true">
    <use href="#i-media" />
  </svg>
);
/* The four store sub-item glyphs (prototype sidebar, #store-sub). */
const CART_13 = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M1.5 2h2l1.6 8h7.4l1.5-5.5H4.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="6.2" cy="13" r="1" fill="currentColor" />
    <circle cx="11.8" cy="13" r="1" fill="currentColor" />
  </svg>
);
const BAG_13 = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 5h10l-.8 9H3.8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M5.75 5V4a2.25 2.25 0 0 1 4.5 0v1" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);
const CATS_13 = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="5.5" y="1.75" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <rect x="1.75" y="10.25" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <rect x="9.25" y="10.25" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
    <path d="M8 5.75V8M4.25 10.25V8h7.5v2.25" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);
const GEAR_13 = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <use href="#i-settings" />
  </svg>
);

/* SITE_VIEW_TITLES from render(): the per-view document titles and the
   sidebar labels the "coming soon" toast echoes. */
const SITE_VIEW_TITLES: Record<string, string> = { overview: "Overview", pages: "Website Pages", products: "Products", orders: "Orders", categories: "Categories" };
const NAV_LABELS: Record<string, string> = {
  cms: "Content/CMS",
  media: "Media Library",
  permissions: "Site Permissions",
  settings: "Site Settings",
  orders: "Order",
  categories: "Categories",
  checkout: "Checkout Settings",
};

const THEME_BG: Record<string, string> = { alicia: "#1f3d2b", nova: "#2f5da8", axis: "#111", sun: "#e0892d", plain: "#b5b2a8" };

const EXT_ICON = (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><use href="#i-external" /></svg>
);

/* svgI() glyphs from renderSiteOverview(), same sizes / viewBoxes / strokes. */
const CHEV_R = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const I_GLOBE = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.3" /><path d="M1.75 8h12.5M8 1.75c1.9 2 1.9 10.5 0 12.5M8 1.75c-1.9 2-1.9 10.5 0 12.5" stroke="currentColor" strokeWidth="1.3" /></svg>
);
const docPaths = (
  <>
    <path d="M4 1.75h5.5L13 5.25v9H4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M9.25 1.75v3.75H13M6.5 8.5h4M6.5 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </>
);
const I_DOC = <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">{docPaths}</svg>;
/* Quick Stats draws the doc glyph at 18px (I_DOC.replace(...) in the prototype). */
const I_DOC_18 = <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">{docPaths}</svg>;
const I_CLOCK = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.3" /><path d="M8 4.5V8l2.3 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
);
const I_CART = (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.5 2h2l1.6 8h7.4l1.5-5.5H4.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6.2" cy="13" r="1" fill="currentColor" /><circle cx="11.8" cy="13" r="1" fill="currentColor" /></svg>
);
const I_POST = (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M5 5.5h6M5 8h6M5 10.5h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
);
const I_MEDIA = (
  <svg width="22" height="22" viewBox="0 0 18 18" fill="none" aria-hidden="true"><rect x="1.5" y="3.5" width="10" height="10.5" rx="1" stroke="currentColor" strokeWidth="1.4" /><path d="m2.5 12.5 3-3 2 2 1.25-1.25 2.75 2.75" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><circle cx="5" cy="6.75" r="1" fill="currentColor" /><rect x="13.75" y="3.5" width="3" height="4.25" rx=".6" stroke="currentColor" strokeWidth="1.4" /><rect x="13.75" y="9.75" width="3" height="4.25" rx=".6" stroke="currentColor" strokeWidth="1.4" /></svg>
);
const I_ALERT = (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" /><path d="M8 4.8v3.7M8 11h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);

const MINUS = 24 * 60 * 60 * 1000;

type SiteLite = { id: string; name: string; theme: string };

/* The topbar site switcher: lists the active workspace's sites only. Opening it
   repeats the prototype's fitSwitcher()/placeCaret() behaviour. */
function SiteSwitcher({
  sites,
  activeSiteId,
  onSelect,
}: {
  sites: SiteLite[];
  activeSiteId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const current = sites.find((s) => s.id === activeSiteId);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fitSwitcher = () => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      scroll.style.setProperty("--k", "1");
      const avail = parseFloat(getComputedStyle(scroll).maxHeight) || window.innerHeight;
      for (let i = 0; i < 6; i++) {
        const k = parseFloat(scroll.style.getPropertyValue("--k"));
        const need = scroll.scrollHeight;
        if (need <= avail + 1) break;
        scroll.style.setProperty("--k", Math.max(0.35, (k * (avail - 4)) / need).toFixed(3));
      }
    };
    const placeCaret = () => {
      const chev = btnRef.current?.querySelector(".chev");
      const panel = panelRef.current;
      if (!chev || !panel) return;
      const c = chev.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      panel.style.setProperty("--caret-x", `${c.left + c.width / 2 - p.left}px`);
    };
    fitSwitcher();
    placeCaret();
    searchRef.current?.focus();
    const onResize = () => {
      fitSwitcher();
      placeCaret();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = sites.filter((s) => !q || s.name.toLowerCase().includes(q));

  return (
    <div className="switcher-wrap">
      <button
        ref={btnRef}
        className="switcher-btn"
        id="switcher-btn"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="switcher-panel"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="switcher-ico" id="switcher-mark" aria-hidden="true">
          {current ? (
            <span className="wmark" style={{ "--s": "22px", background: THEME_BG[current.theme] ?? "#b5b2a8" } as React.CSSProperties}>
              {current.name.slice(0, 1)}
            </span>
          ) : null}
        </span>
        <span className="label" id="switcher-label">{current ? current.name : "No sites yet"}</span>
        {icon("i-chevron-down", 16, 16, "0 0 16 16", "chev")}
      </button>

      <div className="switcher-panel" id="switcher-panel" ref={panelRef} hidden={!open}>
        <div className="switcher-scroll" ref={scrollRef}>
          <div className="switcher-search">
            {icon("i-search")}
            <label className="sr-only" htmlFor="switcher-search">Search sites</label>
            <input
              ref={searchRef}
              id="switcher-search"
              type="search"
              placeholder="Search sites"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="switcher-group" id="sw-sites-group" hidden={!filtered.length}>
            <h2>Sites</h2>
            <ul className="switcher-list" data-group="site" id="sw-site-list">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    className="switcher-item"
                    aria-current={activeSiteId === s.id ? "true" : undefined}
                    data-site-item={s.id}
                    data-name={s.name}
                    onClick={() => { onSelect(s.id); close(); }}
                  >
                    <span className="ico">
                      <span className="wmark" style={{ "--s": "28px", background: THEME_BG[s.theme] ?? "#b5b2a8" } as React.CSSProperties} aria-hidden="true">
                        {s.name.slice(0, 1)}
                      </span>
                    </span>
                    <span className="name">{s.name}</span>
                    {icon("i-check", 22, 22, "0 0 24 24", "check")}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <p className="switcher-empty" id="switcher-empty" hidden={filtered.length > 0 || !q}>No workspaces or sites match that search.</p>

          <Link to="/workspace" className="create-site" onClick={() => setOpen(false)}>
            {icon("i-plus", 18)}
            Create new site
          </Link>
        </div>
      </div>
    </div>
  );
}

/* The health ring. The bar is rendered straight at its final value (so it is
   correct on the server, on hydration and in StrictMode) and a CSS keyframe
   paints it in from empty, the same 0.6s ease the prototype uses. */
function HealthRing({ score, color }: { score: number; color: string }) {
  const C = 2 * Math.PI * 47;
  const off = C * (1 - score / 100);
  return (
    <div className="ring" style={{ "--rc": color } as React.CSSProperties} role="img" aria-label={`Health score ${score} out of 100`}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="track" cx="50" cy="50" r="47" strokeWidth="6" fill="none" stroke="#e6f5ef" />
        <circle
          key={score}
          className="bar"
          cx="50"
          cy="50"
          r="47"
          strokeWidth="6"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={off}
          style={{ "--ring-c": `${C}px` } as React.CSSProperties}
        />
      </svg>
      <span className="val"><strong>{score}</strong><small>/100</small></span>
    </div>
  );
}

/* siteData(s) - the deterministic demo values behind the Overview numbers. */
const STATUS_LABEL: Record<string, string> = { published: "Published", unpublished: "Unpublished", draft: "Draft" };

function siteData(s: { id: string; name: string; status: string; theme: string; updated: string; domain?: string | null }) {
  const n = [...s.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const live = s.status === "published";
  const shop = s.theme === "alicia" || s.theme === "sun";
  const ago = ["2 hours ago", "Yesterday", "3 days ago", "4 days ago", "5 days ago"];
  const states = live ? ["unpublished", "published", "published", "draft", "published"] : ["draft", "draft", "unpublished", "draft", "draft"];
  const sets = shop
    ? [["Home Page", "/"], ["Store Front", "/shop"], ["About Us", "/about"], ["Blog", "/blog"], ["Contact Us", "/contact"]] as const
    : [["Home Page", "/"], ["Services", "/services"], ["Case Studies", "/work"], ["About Us", "/about"], ["Contact Us", "/contact"]] as const;
  const pages = sets.map(([name, path], i) => ({ name, path, mod: ago[i], status: states[i] }));
  const issues: { lvl: "warn" | "info" | "bad"; title: string; text: string }[] = [];
  const m = 1 + (n % 3);
  issues.push({
    lvl: "warn",
    title: `${m} ${m === 1 ? "page has a" : "pages have"} missing meta ${m === 1 ? "description" : "descriptions"}`,
    text: "Add meta descriptions to improve SEO visibility and search results.",
  });
  if (live) issues.push({ lvl: "info", title: "SSL certificate expires soon", text: `Your SSL certificate will expire in ${8 + (n % 9)} days. Renew to avoid downtime.` });
  else issues.push({ lvl: "info", title: "No domain connected", text: "Connect a domain before you publish so visitors can find the site." });
  if (s.status === "unpublished") issues.unshift({ lvl: "bad", title: "Site is offline", text: "This site was unpublished. Visitors see a “Site not available” page." });
  const score = live ? 98 : s.status === "draft" ? 84 : 61;
  const updatedMs = new Date(s.updated || Date.now()).getTime();
  return {
    domain: s.domain || slugify(s.name).replace(/-/g, "") + ".ro",
    live,
    score,
    pages,
    issues,
    shop,
    pending: 1 + (n % 4),
    stats: { pages: 6 + (n % 9), products: shop ? 12 + (n % 20) : 0, posts: 3 + (n % 9), media: 20 + (n % 30) },
    published: live ? timeAgo(updatedMs) : s.status === "unpublished" ? timeAgo(updatedMs - 9 * MINUS) : "Never",
  };
}

export default function Overview() {
  /* The workspaces + sites rows come from the shared pathless layout
     (routes/workspace-data.tsx), so clicking a site card or a sidebar row is a
     client-side transition with no second read of the same data. */
  const data = useRouteLoaderData<typeof workspaceDataLoader>("routes/workspace-data")!;
  const actionResult = useActionData<typeof action>();
  const { toast, setToast } = useResultToast(actionResult, null);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // SITE_VIEW_TITLES lookup from render(): path.split('/')[2] decides the
  // view, anything unknown falls back to the overview.
  const viewSeg = pathname.replace(/\/+$/, "").split("/")[2] ?? "";
  const siteView = SITE_VIEW_TITLES[viewSeg] ? viewSeg : "overview";

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(data.workspaces[0]?.id ?? null);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [footOpen, setFootOpen] = useState(false);
  const [footQuery, setFootQuery] = useState("");
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [screenToast, setScreenToast] = useState<{ text: string; label?: string; action?: () => void } | null>(null);
  // Row data per site: generated on first visit, then kept in state so edits
  // survive moving between the three site views.
  const [pagesBySite, setPagesBySite] = useState<Record<string, WebPage[]>>({});
  const [productsBySite, setProductsBySite] = useState<Record<string, Product[]>>({});
  const [ordersBySite, setOrdersBySite] = useState<Record<string, Order[]>>({});
  const [categoriesBySite, setCategoriesBySite] = useState<Record<string, Category[]>>({});

  // state.currentId in the standalone file, shared with the workspace and admin screens.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("dr-current-workspace");
      if (stored && data.workspaces.some((w) => w.id === stored)) setActiveWorkspaceId(stored);
    } catch {
      /* private mode */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeWorkspace = data.workspaces.find((w) => w.id === activeWorkspaceId) ?? data.workspaces[0];
  const SITES = activeWorkspace?.sites ?? [];
  const activeSite = SITES.find((s) => s.id === activeSiteId);
  const dashboard = useMemo(() => (activeSite ? siteData(activeSite) : null), [activeSite]);

  const sitePages: WebPage[] = useMemo(
    () => (activeSite ? (pagesBySite[activeSite.id] ?? generatePages(activeSite)) : []),
    [activeSite, pagesBySite],
  );
  const siteProducts: Product[] = useMemo(
    () => (activeSite ? (productsBySite[activeSite.id] ?? generateProducts(activeSite)) : []),
    [activeSite, productsBySite],
  );
  const siteOrders: Order[] = useMemo(
    () => (activeSite ? (ordersBySite[activeSite.id] ?? generateOrders(activeSite)) : []),
    [activeSite, ordersBySite],
  );
  const siteCategories: Category[] = useMemo(
    () => (activeSite ? (categoriesBySite[activeSite.id] ?? generateCategories(activeSite)) : []),
    [activeSite, categoriesBySite],
  );
  const setSitePages = (updater: (list: WebPage[]) => WebPage[]) => {
    if (!activeSite) return;
    const site = activeSite;
    setPagesBySite((m) => ({ ...m, [site.id]: updater(m[site.id] ?? generatePages(site)) }));
  };
  const setSiteProducts = (updater: (list: Product[]) => Product[]) => {
    if (!activeSite) return;
    const site = activeSite;
    setProductsBySite((m) => ({ ...m, [site.id]: updater(m[site.id] ?? generateProducts(site)) }));
  };
  const setSiteOrders = (updater: (list: Order[]) => Order[]) => {
    if (!activeSite) return;
    const site = activeSite;
    setOrdersBySite((m) => ({ ...m, [site.id]: updater(m[site.id] ?? generateOrders(site)) }));
  };
  const setSiteCategories = (updater: (list: Category[]) => Category[]) => {
    if (!activeSite) return;
    const site = activeSite;
    setCategoriesBySite((m) => ({ ...m, [site.id]: updater(m[site.id] ?? generateCategories(site)) }));
  };

  const sidebarRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const footBtnRef = useRef<HTMLButtonElement>(null);
  const footMenuRef = useRef<HTMLDivElement>(null);
  const menuOpenRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);

  const filteredWs = footQuery.trim()
    ? data.workspaces.filter((w) => w.name.toLowerCase().includes(footQuery.trim().toLowerCase()))
    : data.workspaces;

  const selectSite = (id: string) => setActiveSiteId(id);
  const selectWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    setFootOpen(false);
    setFootQuery("");
    try {
      window.localStorage.setItem("dr-current-workspace", id);
    } catch {
      /* private mode */
    }
  };

  const openMenu = () => {
    setMenuOpen(true);
    requestAnimationFrame(() => menuCloseRef.current?.focus());
  };
  const closeMenu = (returnFocus = false) => {
    setMenuOpen(false);
    if (returnFocus) menuOpenRef.current?.focus();
  };

  /* Outside-click / Escape dismissal for the sidebar foot menu and the drawer. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
      setFootOpen(false);
      setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!footOpen) return;
    const onDown = (e: MouseEvent) => {
      if (footMenuRef.current?.contains(e.target as Node) || footBtnRef.current?.contains(e.target as Node)) return;
      setFootOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [footOpen]);

  // renderOverviewSwitcher(): keep the site selection valid, defaulting to the first site.
  useEffect(() => {
    if (!SITES.length) {
      if (activeSiteId !== null) setActiveSiteId(null);
      return;
    }
    if (!activeSiteId || !SITES.some((s) => s.id === activeSiteId)) setActiveSiteId(SITES[0].id);
  }, [activeSiteId, SITES]);

  /* fitSidebar(): tighten sidebar spacing on short desktop screens. */
  const fitSidebar = useCallback(() => {
    const el = sidebarRef.current;
    if (!el) return;
    el.style.setProperty("--k", "1");
    if (window.matchMedia("(max-width: 760px)").matches) return;
    for (let i = 0; i < 6; i++) {
      const k = parseFloat(el.style.getPropertyValue("--k"));
      const need = el.scrollHeight;
      const avail = el.clientHeight;
      if (need <= avail + 1) break;
      el.style.setProperty("--k", Math.max(0.35, (k * (avail - 4)) / need).toFixed(3));
    }
  }, []);

  useEffect(() => {
    fitSidebar();
    window.addEventListener("resize", fitSidebar);
    return () => window.removeEventListener("resize", fitSidebar);
  }, [fitSidebar]);

  // setSiteNav(true) runs on every render of the /overview route: the store
  // group opens only on the products view and collapses anywhere else, while
  // a manual toggle survives until the next view change.
  useEffect(() => setStoreOpen(siteView === "products" || siteView === "orders" || siteView === "categories"), [siteView]);

  /* render(): document title, #workspace-main scrollTop reset, heading focus
     (the prototype focuses every h1, and the effect below re-runs on each
     view change the way its hashchange render() did). */
  useEffect(() => {
    document.title = `${SITE_VIEW_TITLES[siteView]} · Digital Romanian`;
    const main = mainRef.current;
    if (main) main.scrollTop = 0;
    main?.querySelector("h1")?.focus({ preventScroll: true });
  }, [siteView]);

  // The store group re-fits the sidebar when it toggles (the prototype binds
  // fitSidebar() to every .nav-group-btn and calls it on each route render).
  useEffect(() => {
    fitSidebar();
  }, [fitSidebar, storeOpen, siteView]);

  // The toast() slot: 5.2s, same as the standalone file. Server action
  // results keep using useResultToast's state; this one carries the screen
  // actions (Undo, Edit page) the shared toast can't express.
  useEffect(() => {
    if (!screenToast) return;
    const t = window.setTimeout(() => setScreenToast(null), 5200);
    return () => window.clearTimeout(t);
  }, [screenToast]);

  const showToast = (text: string) => {
    setToast(null);
    setScreenToast({ text });
  };
  const showToastAction = (text: string, label: string, action: () => void) => {
    setToast(null);
    setScreenToast({ text, label, action });
  };
  const navToast = (key: string) => showToast(`${NAV_LABELS[key] ?? "This section"} is coming soon`);
  // Inert sidebar rows: preventDefault + "<label> is coming soon".
  const inertNav = (key: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    closeMenu();
    navToast(key);
  };

  const shown = toast ?? screenToast;
  const shownIsScreen = !!screenToast && shown === screenToast;

  return (
    <div className="app" data-route="/overview">
      <header className="topbar has-extras">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button ref={menuOpenRef} className="menu-toggle" id="menu-open" aria-label="Open menu" aria-controls="sidebar" aria-expanded={menuOpen} onClick={openMenu}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Link className="topbar-brand" to="/workspace">
            {DR_LOGO}
            <span>Digital Romanian</span>
          </Link>
        </div>

        <nav className="crumbs" aria-label="Breadcrumb">
          <SiteSwitcher sites={SITES} activeSiteId={activeSiteId} onSelect={selectSite} />

          <div className="tb-extras">
            <a
              className={`tb-domain${dashboard && !dashboard.live ? " off" : ""}`}
              id="ov-domain"
              href={dashboard ? `https://${dashboard.domain}` : "#"}
              target="_blank"
              rel="noopener"
              title={dashboard ? (dashboard.live ? `Open ${dashboard.domain}` : `${dashboard.domain} (not live yet)`) : "Open live site"}
              hidden={!dashboard}
            >
              <span className="dot" aria-hidden="true" />
              <span id="ov-domain-text">{dashboard?.domain ?? ""}</span>
              {EXT_ICON}
            </a>
          </div>
        </nav>

        <div className="tb-right">
          <button className="icon-btn" aria-label="Notifications">{icon("i-bell", 20, 20, "0 0 20 20")}</button>
          <AccountMenu name={data.userName} email={data.email} />
        </div>
      </header>

      <div className="shell">
        <nav className={`sidebar${menuOpen ? " open" : ""}`} id="sidebar" ref={sidebarRef} aria-label="Main">
          <div className="sidebar-head">
            <Link className="topbar-brand" to="/workspace">
              {DR_LOGO}
              <span>Digital Romanian</span>
            </Link>
            <button ref={menuCloseRef} className="icon-btn" id="menu-close" aria-label="Close menu" onClick={() => closeMenu(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <ul className="nav nav-flat">
            <li>
              <Link className="nav-link" to="/overview" data-site-nav="overview" aria-current={siteView === "overview" ? "page" : undefined} onClick={() => closeMenu()}>
                {OVERVIEW_ICON}
                Overview
              </Link>
            </li>
            <li>
              <Link className="nav-link" to="/overview/pages" data-site-nav="pages" aria-current={siteView === "pages" ? "page" : undefined} onClick={() => closeMenu()}>
                <svg className="ic-doc" width="14" height="18" viewBox="0 0 14 18" fill="none" aria-hidden="true">
                  <use href="#i-doc" />
                </svg>
                Website Pages
              </Link>
            </li>
            <li className="nav-grp">
              <button
                type="button"
                className={`nav-link nav-group-btn${siteView === "products" || siteView === "orders" || siteView === "categories" ? " has-current" : ""}`}
                data-store-toggle
                aria-expanded={storeOpen}
                aria-controls="store-sub"
                onClick={() => setStoreOpen((o) => !o)}
              >
                {icon("i-store")}
                E-Commerce / Store
                {icon("i-chevron-down", 14, 14, "0 0 16 16", "chev")}
              </button>
              <ul className="store-sub" id="store-sub" hidden={!storeOpen}>
                <li>
                  <Link to="/overview/products" data-site-nav="products" aria-current={siteView === "products" ? "page" : undefined} onClick={() => closeMenu()}>
                    {CART_13}
                    Products
                  </Link>
                </li>
                <li>
                  <Link to="/overview/orders" data-site-nav="orders" aria-current={siteView === "orders" ? "page" : undefined} onClick={() => closeMenu()}>
                    {BAG_13}
                    Order
                  </Link>
                </li>
                <li>
                  <Link to="/overview/categories" data-site-nav="categories" aria-current={siteView === "categories" ? "page" : undefined} onClick={() => closeMenu()}>
                    {CATS_13}
                    Categories
                  </Link>
                </li>
                <li>
                  <a href="/overview" data-site-nav="checkout" onClick={inertNav("checkout")}>
                    {GEAR_13}
                    Checkout Settings
                  </a>
                </li>
              </ul>
            </li>
            <li>
              <a className="nav-link" href="/overview" data-site-nav="cms" onClick={inertNav("cms")}>
                {CMS_ICON}
                Content/CMS
              </a>
            </li>
            <li>
              <a className="nav-link" href="/overview" data-site-nav="media" onClick={inertNav("media")}>
                {MEDIA_ICON}
                Media Library
              </a>
            </li>
            <li>
              <a className="nav-link" href="/overview" data-site-nav="permissions" onClick={inertNav("permissions")}>
                {icon("i-team")}
                Site Permissions
              </a>
            </li>
            <li>
              <a className="nav-link" href="/overview" data-site-nav="settings" onClick={inertNav("settings")}>
                {icon("i-settings")}
                Site Settings
              </a>
            </li>
          </ul>

          <div className="wsd-foot ov-foot">
            <button
              ref={footBtnRef}
              className="ws-switch"
              data-ws-switch
              aria-haspopup="true"
              aria-expanded={footOpen}
              aria-controls="ov-ws-menu"
              onClick={() => setFootOpen((o) => !o)}
            >
              <span className="ws-switch-mark">
                <Wmark workspace={activeWorkspace} size={34} />
              </span>
              <span className="txt">
                <strong className="ws-switch-name">{activeWorkspace ? activeWorkspace.name : "No workspace yet"}</strong>
                <small>Switch workspace</small>
              </span>
              {icon("i-chevron-right", 16, 16, "0 0 18 17", "chev")}
            </button>

            <div className="ws-menu" id="ov-ws-menu" ref={footMenuRef} hidden={!footOpen}>
              <div className="ws-menu-scroll">
                <div className="switcher-search">
                  {icon("i-search")}
                  <input
                    data-ws-search
                    aria-label="Search workspaces"
                    type="search"
                    placeholder="Search workspaces"
                    autoComplete="off"
                    value={footQuery}
                    onChange={(e) => setFootQuery(e.target.value)}
                  />
                </div>
                <h2>Workspaces</h2>
                <ul className="switcher-list" data-ws-list>
                  {filteredWs.map((w) => (
                    <li key={w.id}>
                      <button className="switcher-item" aria-current={activeWorkspaceId === w.id ? "true" : undefined} onClick={() => selectWorkspace(w.id)}>
                        <span className="ico"><Wmark workspace={w} size={28} /></span>
                        <span className="name">{w.name}</span>
                        {icon("i-check", 22, 22, "0 0 24 24", "check")}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="switcher-empty" data-ws-empty hidden={filteredWs.length > 0}>
                  {data.workspaces.length ? "No workspaces match that search." : "You have no workspaces yet."}
                </p>
                <div className="ws-menu-actions">
                  <button type="button" className="create-site" data-open="create-ws" onClick={() => { setCreateWsOpen(true); setFootOpen(false); }}>
                    {icon("i-plus", 18)}Create new workspace
                  </button>
                  <button
                    type="button"
                    className="create-site"
                    data-open="invite"
                    data-needs-ws
                    disabled={!data.workspaces.length}
                    onClick={() => { setInviteOpen(true); setFootOpen(false); }}
                  >
                    {icon("i-user-plus", 18)}Invite member
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="main" id="workspace-main" ref={mainRef}>
          <div className="ov" id="ov-view">
            {!dashboard || !activeSite ? (
              siteView === "pages" ? (
                <NoSiteView title="Website Pages" sub="Manage your page tree, SEO titles, subpaths, and publishing status." hasWorkspace={!!activeWorkspace} />
              ) : siteView === "products" || siteView === "orders" || siteView === "categories" ? (
                <NoSiteView title="E-Commerce / Store" sub="Manage your products, inventory, order lists, and payment channel toggles." hasWorkspace={!!activeWorkspace} />
              ) : (
                <>
                  <div className="ov-head">
                    <h1 tabIndex={-1}>Overview</h1>
                    <p>Your site cockpit — get a quick view of your site health, key stats and recent activity.</p>
                  </div>
                  <div className="ov-card ov-empty">
                    <h2>{activeWorkspace ? "No sites in this workspace yet" : "You’re not in a workspace yet"}</h2>
                    <p>
                      {activeWorkspace
                        ? "Create your first site and its health, stats and recent activity will show up here."
                        : "Create a workspace to start building sites."}
                    </p>
                    <Link className="btn-dark" to="/workspace">
                      {icon("i-plus", 18)}
                      {activeWorkspace ? "Create new site" : "Go to workspaces"}
                    </Link>
                  </div>
                </>
              )
            ) : siteView === "pages" ? (
              <WebsitePagesView
                key={activeSite.id}
                site={activeSite}
                d={dashboard}
                pages={sitePages}
                setPages={setSitePages}
                showToast={showToast}
                showToastAction={showToastAction}
              />
            ) : siteView === "products" ? (
              <ProductsView
                key={activeSite.id}
                site={activeSite}
                products={siteProducts}
                setProducts={setSiteProducts}
                showToast={showToast}
                showToastAction={showToastAction}
              />
            ) : siteView === "orders" ? (
              <OrdersView
                key={activeSite.id}
                site={activeSite}
                orders={siteOrders}
                setOrders={setSiteOrders}
                showToast={showToast}
              />
            ) : siteView === "categories" ? (
              <CategoriesView
                key={activeSite.id}
                site={activeSite}
                categories={siteCategories}
                setCategories={setSiteCategories}
                showToast={showToast}
                showToastAction={showToastAction}
                onViewProducts={(c) => {
                  showToast(`Showing ${c.count} ${c.count === 1 ? "product" : "products"} in ${c.name}`);
                  navigate("/overview/products");
                }}
              />
            ) : (
              <SiteOverview d={dashboard} showToast={showToast} navToast={navToast} />
            )}
          </div>
        </main>
      </div>

      <div className={`scrim${menuOpen ? " show" : ""}`} id="scrim" onClick={() => closeMenu()} />

      <CreateWorkspaceDialog open={createWsOpen} onClose={() => setCreateWsOpen(false)} actionResult={actionResult} />
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        workspace={activeWorkspace}
        knownPeople={data.directory}
        actionResult={actionResult}
      />
      {shown ? (
        <Toast
          text={shown.text}
          {...(shown.label
            ? {
                link: {
                  label: shown.label,
                  onClick: () => {
                    if (shownIsScreen && screenToast) {
                      const act = screenToast.action;
                      setScreenToast(null);
                      act?.();
                    } else {
                      setToast(null);
                      if (toast?.href) window.location.assign(toast.href);
                    }
                  },
                },
              }
            : {})}
        />
      ) : null}
    </div>
  );
}

/* noSiteView(): the empty shell the two site screens paint when the active
   workspace has no site (or no workspace at all). */
function NoSiteView({ title, sub, hasWorkspace }: { title: string; sub: string; hasWorkspace: boolean }) {
  return (
    <>
      <div className="ov-head">
        <h1 tabIndex={-1}>{title}</h1>
        <p>{sub}</p>
      </div>
      <div className="ov-card ov-empty">
        <h2>{hasWorkspace ? "No sites in this workspace yet" : "You’re not in a workspace yet"}</h2>
        <p>{hasWorkspace ? "Create a site first, then come back here to manage it." : "Create a workspace to start building sites."}</p>
        <Link className="btn-dark" to="/workspace">
          {icon("i-plus", 18)}
          {hasWorkspace ? "Create new site" : "Go to workspaces"}
        </Link>
      </div>
    </>
  );
}

/* renderSiteOverview(): the site cockpit painted into #ov-view. */
function SiteOverview({
  d,
  showToast,
  navToast,
}: {
  d: ReturnType<typeof siteData>;
  showToast: (text: string) => void;
  navToast: (key: string) => void;
}) {
  const health = d.score >= 90 ? ["", "Healthy"] : d.score >= 75 ? ["warn", "Needs attention"] : ["bad", "At risk"];
  // Same colours as the prototype's renderSiteOverview().
  const ringColor = health[0] === "warn" ? "#ef8d03" : health[0] === "bad" ? "#d92d20" : "#009e67";
  const headline =
    d.score >= 90
      ? ["Your site is running smoothly", "No critical issues detected. Your site is performing as expected."]
      : d.score >= 75
        ? ["A few things need a look", "Nothing is broken, but fixing the items under Site Issues will lift your score."]
        : ["Your site needs attention", "The site is offline. Republish it or check Site Issues to get it back up."];
  const st = d.stats;
  const nav = (key: string) => (e: React.MouseEvent) => { e.preventDefault(); navToast(key); };

  return (
    <>
      <div className="ov-head">
        <h1 tabIndex={-1}>Overview</h1>
        <p>Your site cockpit — get a quick view of your site health, key stats and recent activity.</p>
      </div>
      <div className="ov-top">
        <section className="ov-card ov-health" aria-labelledby="ovh-t">
          <header>
            <h2 id="ovh-t">Site Health</h2>
            <span className={`chip-ok ${health[0]}`}>{health[1]}</span>
          </header>
          <div className="hbody">
            <HealthRing score={d.score} color={ringColor} />
            <div>
              <h3>{headline[0]}</h3>
              <p>{headline[1]}</p>
              <div className="mini">
                <span>Speed <b>{d.live ? "Fast" : "—"}</b></span>
                <span>SEO <b>{d.score - 6}</b></span>
                <span>Uptime <b>{d.live ? "99.9%" : "—"}</b></span>
              </div>
            </div>
          </div>
        </section>

        <section className="ov-card ov-status" aria-labelledby="ovs-t">
          <header><h2 id="ovs-t">Site Status</h2></header>
          <div className="srows">
            <div className="srow">
              {I_GLOBE}
              <span className="k">Domain</span>
              <span className="v">{d.domain}</span>
              {d.live ? (
                <span className="chip-ok">Connected</span>
              ) : (
                <button className="srow-a link-sm" onClick={() => showToast("Domain settings open in Site Settings")}>
                  Connect domain{CHEV_R}
                </button>
              )}
            </div>
            <div className="srow">
              {I_DOC}
              <span className="k">Last Published</span>
              <span className="v">{d.published}</span>
              <button className="a" onClick={() => showToast("Publish history coming soon")}>
                View details {CHEV_R}
              </button>
            </div>
            <button className="srow" onClick={() => showToast(`${d.pending} draft ${d.pending === 1 ? "change" : "changes"} ready for review`)}>
              {I_CLOCK}
              <span className="k">Draft Changes</span>
              <span className="v">{d.pending} pending</span>
              <span className="a">
                <span className="chip-ok warn">Needs review</span>
                <span className="chev-r">{CHEV_R}</span>
              </span>
            </button>
          </div>
        </section>
      </div>

      <h2 className="ov-sec">Quick Stats</h2>
      <div className="qstats">
        <div className="ov-card qstat">
          <span className="qi">{I_DOC_18}</span>
          <small>Total Pages</small>
          <strong>{st.pages}</strong>
          <Link to="/overview/pages" data-ov-nav="pages">View all</Link>
        </div>
        <div className="ov-card qstat">
          <span className="qi">{I_CART}</span>
          <small>Products</small>
          <strong>{st.products}</strong>
          <Link to="/overview/products" data-ov-nav="store">{st.products ? "View Store" : "Set up store"}</Link>
        </div>
        <div className="ov-card qstat">
          <span className="qi">{I_POST}</span>
          <small>Blog Posts</small>
          <strong>{st.posts}</strong>
          <a href="/overview" data-ov-nav="cms" onClick={nav("cms")}>View Content</a>
        </div>
        <div className="ov-card qstat">
          <span className="qi">{I_MEDIA}</span>
          <small>Media Files</small>
          <strong>{st.media}</strong>
          <a href="/overview" data-ov-nav="media" onClick={nav("media")}>View Library</a>
        </div>
      </div>

      <div className="ov-bottom">
        <section className="ov-card ov-pages" aria-labelledby="ovp-t">
          <header>
            <h2 id="ovp-t">Recently Edited Pages</h2>
            <Link className="link-sm" to="/overview/pages" data-ov-nav="pages">View details {CHEV_R}</Link>
          </header>
          <div className="ptable" role="table" aria-label="Recently edited pages">
            <div className="prow head" role="row">
              <span role="columnheader">Page Name</span>
              <span role="columnheader">Path</span>
              <span role="columnheader">Last Modified</span>
              <span role="columnheader">Status</span>
              <span />
            </div>
            {d.pages.map((pg) => (
              <button className="prow" role="row" key={pg.path} onClick={() => showToast(`Opening ${pg.name} in the editor`)}>
                <span className="pn" role="cell">{pg.name}</span>
                <code role="cell">{pg.path}</code>
                <span className="lm" role="cell">{pg.mod}</span>
                <span className="st" role="cell"><span className={`spill ${pg.status}`}>{STATUS_LABEL[pg.status]}</span></span>
                {CHEV_R}
              </button>
            ))}
          </div>
        </section>

        <section className="ov-card ov-issues" aria-labelledby="ovi-t">
          <header>
            <h2 id="ovi-t"><span className="ib" aria-hidden="true">!</span>Site Issues &amp; Attention</h2>
            <span className="count-b" aria-label={`${d.issues.length} issues`}>{d.issues.length}</span>
          </header>
          <div className="issues">
            {d.issues.map((i) => (
              <button className={`issue ${i.lvl}`} key={i.title} onClick={() => showToast(`${i.title}: fix it from Site Settings`)}>
                <span className="ic">{I_ALERT}</span>
                <span><strong>{i.title}</strong><small>{i.text}</small></span>
                {CHEV_R}
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}