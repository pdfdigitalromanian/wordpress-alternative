import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { slugify } from "~/lib/slugify";
import { timeAgo } from "~/lib/workspace-view";

/* Pages (#/overview/pages) and E-Commerce / Store → Products
   (#/overview/products), the two site screens digital-romanian-screen.html
   paints into #ov-view from renderPagesView()/renderProductsView() plus their
   two dialogs. Markup, copy, mock catalogue, validation messages and empty
   states mirror that file one-for-one.

   Two deliberate differences from the prototype's innerHTML repaints:
   - the row data lives in the route component (as props), so adding or
     deleting a row survives navigating between the three site views;
   - clicks are React handlers instead of delegated [data-*] lookups. */

const icon = (id: string, w = 16, h = w, vb = `0 0 ${w} ${h}`) => (
  <svg width={w} height={h} viewBox={vb} fill="none" aria-hidden="true">
    <use href={`#${id}`} />
  </svg>
);

/* svgI() / literal glyphs the two screens draw. */
const I_SLIDERS = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M2.5 4.5h6M12 4.5h1.5M2.5 11.5h1.5M7.5 11.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="10.25" cy="4.5" r="1.75" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="5.75" cy="11.5" r="1.75" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);
const I_CHECK_C = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="#1fae5b" />
    <path d="m5 8.2 2 2 4-4.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const I_CLOUD = (
  <svg width="36" height="28" viewBox="0 0 36 28" fill="none" aria-hidden="true">
    <use href="#i-cloud-up" />
  </svg>
);
const PREV = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const NEXT = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const TICK = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ------------------------------------------------------------------ types */

export type WebPage = {
  id: string;
  name: string;
  path: string;
  tpl: string;
  status: "published" | "draft";
  ic: string;
};

export type ArticleSeo = {
  title: string;
  meta: string;
  slug: string;
  index: boolean;
  auto: { title: boolean; meta: boolean };
  ogUse: boolean;
  og: string | null;
};

export type Article = {
  id: string;
  title: string;
  slug: string;
  author: string;
  status: "published" | "draft";
  date: number;
  emoji: string;
  tint: string;
  photo: string | null;
  img: string | null;
  excerpt: string;
  excerptCustom?: boolean;
  body?: string;
  /* Sanitised HTML snippet of body, computed in the browser on save so the
     list row renders real formatting without touching document on SSR. */
  bodySnip?: string;
  seo?: ArticleSeo;
};

export type Product = {
  id: string;
  name: string;
  sub: string;
  sku: string;
  price: number;
  /* Compare-at price; omitted on the seeded catalogue, so the Products table
     only strikes through a regular price that is above the sale price. */
  regular?: number;
  stock: number;
  emoji: string;
  cat: string;
  /* Prototype products carry their own photo id; a product added through the
     dialog doesn't, and thumbSrc() falls back to the category photo. */
  photo?: string;
  status: "published" | "draft" | "archived";
  img: string | null;
  desc: string;
  seo?: ProductSeo;
};

export type ProductSeo = {
  title: string;
  meta: string;
  slug: string;
  index: boolean;
  auto: { title: boolean; meta: boolean; slug: boolean };
};

export type ProductDraft = {
  name: string;
  sku: string;
  cat: string;
  stock: number;
  price: number;
  regular: number;
  desc: string;
  img: string | null;
  sub: string;
  seo: ProductSeo;
};

type SiteLite = { id: string; theme: string };

/* ------------------------------------------------- mock catalogue + pages */

const CATS = ["Eggs & Dairy", "Fresh Produce", "Meat & Poultry", "Bakery", "Pantry"];
const CAT_TINT: Record<string, string> = {
  "Eggs & Dairy": "#f5eedf",
  "Fresh Produce": "#e6f0de",
  "Meat & Poultry": "#f6e3de",
  Bakery: "#f3e6d4",
  Pantry: "#f7ecd2",
};
const CAT_EMOJI: Record<string, string> = {
  "Eggs & Dairy": "🥚",
  "Fresh Produce": "🥬",
  "Meat & Poultry": "🍗",
  Bakery: "🍞",
  Pantry: "🍯",
};
const BASE_PRODUCTS: [string, string, string, number, number, string, string, string][] = [
  ["Organic Farm Eggs", "Free range, 12 pcs", "OF-EGG-12", 4.99, 120, "🥚", "Eggs & Dairy", "1498654077810-12c21d4d6dc3"],
  ["Farm Fresh Milk", "1L, whole milk", "FF-MILK-1L", 2.99, 85, "🥛", "Eggs & Dairy", "1639151082235-406d8eb262b9"],
  ["Organic Vegetables Box", "Seasonal mix, 5kg", "ORG-VEG-BOX", 12.99, 42, "🥬", "Fresh Produce", "1635450370155-d6a650322fa5"],
  ["Homemade Cheese", "Traditional recipe, 500g", "HMT-CHS-500", 7.49, 28, "🧀", "Eggs & Dairy", "1654184729393-e9d3b8c589c5"],
  ["Fresh Chicken", "1kg, boneless", "FR-CHK-1KG", 6.99, 0, "🍗", "Meat & Poultry", "1633096013004-e2cb4023b560"],
  ["Garden Honey", "Wildflower, 500g", "GD-HNY-500", 8.99, 64, "🍯", "Pantry", "1587049352851-8d4e89133924"],
  ["Artisan Bread", "Sourdough, 1 loaf", "ART-BRD-1L", 3.99, 19, "🍞", "Bakery", "1590301157172-7ba48dd1c2b2"],
  ["Farm Fresh Apples", "1kg", "FF-APL-1KG", 2.49, 76, "🍎", "Fresh Produce", "1560806887-1e4cd0b6cbd6"],
];
const MORE_PRODUCTS: [string, string, string, string, string][] = [
  ["Goat Milk Yoghurt", "Plain, 500g", "🥛", "Eggs & Dairy", "1571212515416-fef01fc43637"],
  ["Duck Eggs", "Free range, 6 pcs", "🥚", "Eggs & Dairy", "1577111426685-1b46c38b90f5"],
  ["Heirloom Tomatoes", "Mixed, 1kg", "🍅", "Fresh Produce", "1567375698463-b8dabb1319cf"],
  ["Cultured Butter", "Salted, 250g", "🧈", "Eggs & Dairy", "1589985270826-4b7bb135bc9d"],
  ["Rye Sourdough", "Dark rye, 1 loaf", "🍞", "Bakery", "1549413468-cd78edb7e75c"],
  ["Raw Honeycomb", "Wildflower, 300g", "🍯", "Pantry", "1642067958024-1a2d9f836920"],
  ["Beef Mince", "Grass fed, 500g", "🥩", "Meat & Poultry", "1612078894671-f11ba41d713e"],
  ["Smoked Bacon", "Dry cured, 200g", "🥓", "Meat & Poultry", "1694983361629-0363ab0d1b49"],
  ["Strawberries", "500g punnet", "🍓", "Fresh Produce", "1587393855524-087f83d95bc9"],
  ["Blueberries", "250g punnet", "🫐", "Fresh Produce", "1594002348772-bc0cb57ade8b"],
  ["Bunched Carrots", "1kg", "🥕", "Fresh Produce", "1598170845058-32b9d6a5da37"],
  ["New Potatoes", "Washed, 2kg", "🥔", "Fresh Produce", "1518977676601-b53f82aba655"],
  ["Sweet Corn", "2 cobs", "🌽", "Fresh Produce", "1629570585008-27e194a5d0f8"],
  ["Conference Pears", "1kg", "🍐", "Fresh Produce", "1570115114436-63d3405246e7"],
  ["Unwaxed Lemons", "4 pcs", "🍋", "Fresh Produce", "1590502593747-42a996133562"],
  ["Smoked Garlic", "3 bulbs", "🧄", "Fresh Produce", "1540148426945-6cf22a6b2383"],
  ["Red Onions", "1kg", "🧅", "Fresh Produce", "1618512496248-a07fe83aa8cb"],
  ["Bell Peppers", "Mixed, 3 pcs", "🫑", "Fresh Produce", "1526470303-82c787d88682"],
  ["Cucumbers", "2 pcs", "🥒", "Fresh Produce", "1449300079323-02e209d9d3a6"],
  ["Plum Jam", "Homemade, 340g", "🫙", "Pantry", "1610135373101-89aeeab8fa50"],
];
/* Real product photos (Unsplash). New products without an upload use their
   category's photo. */
const CAT_PHOTO: Record<string, string> = {
  "Eggs & Dairy": "1498654077810-12c21d4d6dc3",
  "Fresh Produce": "1635450370155-d6a650322fa5",
  "Meat & Poultry": "1612078894671-f11ba41d713e",
  Bakery: "1590301157172-7ba48dd1c2b2",
  Pantry: "1587049352851-8d4e89133924",
};

const photoUrl = (id: string) => `https://images.unsplash.com/photo-${id}?w=120&h=120&fit=crop&auto=format&q=70`;
const thumbSrc = (p: { img: string | null; photo?: string; cat: string }) => p.img || photoUrl(p.photo || CAT_PHOTO[p.cat] || CAT_PHOTO["Fresh Produce"]);
const abbr = (n: string) =>
  n
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.slice(0, 3))
    .join("-");

export const money = (n: number) => "$" + Number(n).toFixed(2);

/* Product SEO (mirrors digital-romanian-screen.html's seoSlug/seoTwo/seoCut). */
const SEO_T = 60;
const SEO_D = 160;
const seoSlugify = (n: string) =>
  "/products/" +
  n
    .toLowerCase()
    .replace(/\(.*?\)/g, (m) => m.slice(1, -1))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const seoTwo = (t: string) => {
  const m = t
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?]+[.!?]+/g);
  return m ? m.slice(0, 2).join(" ").trim() : t.trim();
};
const seoCut = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "\u2026" : t);

/* storeOf(s): the demo catalogue. The prototype gates this on
   isShop(s) (theme alicia/sun), which leaves a brand-new "Untitled site"
   (theme plain) with an empty products table and Services/Case Studies pages
   instead of the ones digital-romanian-screen.html opens with. Every site
   therefore gets the file's dummy default data. */
export function generateProducts(site: SiteLite): Product[] {
  const products: Product[] = [];
  BASE_PRODUCTS.forEach(([name, sub, sku, price, stock, emoji, cat, photo], i) =>
    products.push({ id: `${site.id}p${i}`, name, sub, sku, price, stock, emoji, cat, photo, status: "published", img: null, desc: "" }),
  );
  [0, 1].forEach((v) =>
    MORE_PRODUCTS.forEach(([n, sub, emoji, cat, photo], i) => {
      let stock = (i * 23 + v * 41) % 95;
      if ((i + v * 3) % 9 === 4) stock = 0;
      products.push({
        id: `${site.id}p${v}-${i}`,
        name: v ? `Bulk ${n}` : n,
        sub: v ? `Wholesale case, ${sub}` : sub,
        sku: abbr(n) + (v ? "-BLK" : "-" + String(i + 1).padStart(2, "0")),
        price: Math.floor(2 + ((i * 1.7) % 9) + v * 11) + (i % 2 ? 0.49 : 0.99),
        stock,
        emoji,
        cat,
        photo,
        status: (i + v) % 6 === 3 ? "draft" : "published",
        img: null,
        desc: "",
      });
    }),
  );
  return products;
}

/* pagesOf(s) */
export function generatePages(site: SiteLite): WebPage[] {
  const rows: [string, string, string, "published" | "draft", string][] = [
    ["Home Page", "/", "Default Landing", "published", "home"],
    ["Shop Storefront", "/shop", "E-Commerce Grid", "published", "shop"],
    ["About Our Farm", "/about", "Standard Content", "draft", "about"],
    ["Contact Us", "/contact", "Contact Form Layout", "published", "contact"],
  ];
  return rows.map(([name, path, tpl, status, ic], i) => ({ id: `${site.id}w${i}`, name, path, tpl, status, ic }));
}

const PAGE_TPLS = ["Default Landing", "E-Commerce Grid", "Standard Content", "Contact Form Layout", "Blog Index", "Blank Canvas"];

/* Author = the site role the article is posted under (shop manager left out). */
const AUTHOR_ROLES = ["Admin", "Editor", "Content"];

const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtTime = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/* articlesOf(s): farm sites open with two seeded posts, every other site with
   a single welcome article — same seeds as articlesOf() in wp.html. */
export function generateArticles(site: SiteLite & { name: string; updated?: string }): Article[] {
  const shop = isShopSite(site);
  const seed: [string, string, string, number, string, string, string | null][] = shop
    ? [
        ["5 Tips for Raising Healthy Broilers", "5-tips-raising-broilers", "Practical tips to keep your broilers healthy, improve growth, and boost productivity.", new Date(2026, 9, 14, 10, 24).getTime(), "🐔", "#f6e3de", "1548550023-2bdb3c5beed7"],
        ["Why We Use Bitter Leaf for Poultry", "bitter-leaf-poultry", "Learn how bitter leaf helps improve digestion, boost, and promote better poultry health.", new Date(2026, 9, 5, 12, 49).getTime(), "🌿", "#e6f0de", "1500382017468-9049fed747ef"],
      ]
    : [
        [`Welcome to ${site.name}`, "welcome", "A short introduction to who we are, what we do and how we can help.", new Date(site.updated || Date.now()).getTime() || Date.now(), "👋", "#dfe8f7", null],
      ];
  return seed.map(([title, slug, excerpt, date, emoji, tint, photo], i) => ({
    id: `${site.id}a${i}`,
    title,
    slug,
    excerpt,
    author: "Admin",
    status: "published" as const,
    date,
    emoji,
    tint,
    photo,
    img: null,
  }));
}

function wIcon(k: string) {
  if (k === "shop") return icon("i-store", 13, 13, "0 0 16 16");
  if (k === "doc") return icon("i-doc", 11, 14, "0 0 14 18");
  if (k === "about") return icon("i-tractor", 15, 12, "0 0 20 16");
  if (k === "contact") return icon("i-phone", 14, 14, "0 0 20 20");
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2.75 7.4 9 2.5l6.25 4.9v7.35a.75.75 0 0 1-.75.75h-3.25v-4.75h-4.5v4.75H3.5a.75.75 0 0 1-.75-.75z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const statusPill = (p: Product) =>
  p.status === "archived" ? (
    <span className="spill2 archived">Archived</span>
  ) : p.status === "draft" ? (
    <span className="spill2 draft">Draft</span>
  ) : p.stock === 0 ? (
    <span className="spill2 out">Out of Stock</span>
  ) : (
    <span className="spill2">Published</span>
  );

/* ------------------------------------------------------------- row menus */

type MenuItem =
  | { kind: "heading"; label: string }
  | { kind: "divider" }
  | { kind: "item"; label: string; danger?: boolean; href?: string; checked?: boolean; onSelect?: () => void };

/* The prototype's more-menu opener: opens on click, flips up when it would
   leave the main scroll area (placeRowMenu()), closes on an outside click or
   Escape and hands focus to its first entry. */
function MoreMenu({
  ariaLabel,
  items,
  className = "row-menu",
  buttonClassName = "more-btn",
  buttonContent = icon("i-more"),
}: {
  ariaLabel: string;
  items: MenuItem[];
  className?: string;
  buttonClassName?: string;
  buttonContent?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) {
      setUp(false);
      return;
    }
    const menu = menuRef.current;
    const main = document.getElementById("workspace-main");
    if (menu && main) {
      const r = menu.getBoundingClientRect();
      const m = main.getBoundingClientRect();
      setUp(r.bottom > Math.min(m.bottom, window.innerHeight) - 12);
    }
    menuRef.current?.querySelector<HTMLElement>("button, a")?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close(true);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <span className="menu-anchor" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={buttonClassName}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={ariaLabel}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        {buttonContent}
      </button>
      <div className={`more-menu ${className}${up ? " up" : ""}`} role="menu" hidden={!open} ref={menuRef}>
        {items.map((it, i) =>
          it.kind === "heading" ? (
            <p className="menu-label" key={i}>{it.label}</p>
          ) : it.kind === "divider" ? (
            <hr key={i} />
          ) : it.href ? (
            <a key={i} href={it.href} target="_blank" rel="noopener">{it.label}</a>
          ) : (
            <button
              key={i}
              type="button"
              role={it.checked === undefined ? "menuitem" : "menuitemradio"}
              aria-checked={it.checked}
              className={it.danger ? "danger" : undefined}
              onClick={() => {
                it.onSelect?.();
                close(true);
              }}
            >
              {it.label}
              {it.checked ? TICK : null}
            </button>
          ),
        )}
      </div>
    </span>
  );
}

/* pagerHTML() */
function Pager({ current, pages, onChange, label = "Product pages" }: { current: number; pages: number; onChange: (n: number) => void; label?: string }) {
  const start = Math.max(1, Math.min(current - 2, pages - 4));
  const end = Math.min(pages, start + 4);
  const shown: number[] = [];
  for (let i = start; i <= end; i++) shown.push(i);
  return (
    <nav className="pager" aria-label={label}>
      <button type="button" aria-label="Previous page" disabled={current <= 1} onClick={() => onChange(current - 1)}>{PREV}</button>
      {shown.map((i) => (
        <button key={i} type="button" aria-label={`Page ${i}`} aria-current={i === current ? "page" : undefined} onClick={() => onChange(i)}>
          {i}
        </button>
      ))}
      {end < pages ? <span aria-hidden="true">…</span> : null}
      <button type="button" aria-label="Next page" disabled={current >= pages} onClick={() => onChange(current + 1)}>{NEXT}</button>
    </nav>
  );
}

/* --------------------------------------------------------- products view */

const FILTERS: Record<string, string> = { all: "All products", published: "Published", draft: "Draft", archived: "Archived", out: "Out of stock" };
type FilterKey = "all" | "published" | "draft" | "archived" | "out";

const PER_PAGE = 8;

export function ProductsView({
  site,
  d,
  products,
  setProducts,
  showToast,
  showToastAction,
}: {
  site: SiteLite & { name: string };
  d?: { domain: string } | null;
  products: Product[];
  setProducts: (updater: (list: Product[]) => Product[]) => void;
  showToast: (text: string) => void;
  showToastAction: (text: string, label: string, action: () => void) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ open: boolean; edit: Product | null }>({ open: false, edit: null });

  const q = query.trim().toLowerCase();
  const list = products.filter(
    (p) =>
      (filter === "all" ||
        (filter === "out"
          ? p.stock === 0 && p.status === "published"
          : filter === "draft"
            ? p.status === "draft"
            : filter === "archived"
              ? p.status === "archived"
              : p.status === "published" && p.stock > 0)) &&
      (!q || [p.name, p.sub, p.sku, p.cat].some((x) => x.toLowerCase().includes(q))),
  );
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(Math.max(1, page), pages);
  const start = (cur - 1) * PER_PAGE;
  const rows = list.slice(start, start + PER_PAGE);

  const openDialog = (edit: Product | null) => setDialog({ open: true, edit });

  const duplicate = (src: Product) => {
    setProducts((list) => {
      const i = list.findIndex((x) => x.id === src.id);
      if (i < 0) return list;
      let sku = src.sku + "-C";
      let n = 2;
      while (list.some((x) => x.sku === sku)) sku = `${src.sku}-C${n++}`;
      const next = [...list];
      next.splice(i + 1, 0, { ...src, id: site.id + "p" + Date.now(), name: src.name + " copy", sku, status: "draft" });
      return next;
    });
    showToast(`${src.name} duplicated as a draft`);
  };

  const toggleArchive = (src: Product) => {
    const now: Product["status"] = src.status === "archived" ? "published" : "archived";
    setProducts((list) => list.map((x) => (x.id === src.id ? { ...x, status: now } : x)));
    showToast(`${src.name} ${now === "archived" ? "archived" : "restored"}`);
  };

  const publish = (src: Product) => {
    setProducts((list) => list.map((x) => (x.id === src.id ? { ...x, status: "published" } : x)));
    showToast(`${src.name} published`);
  };

  const remove = (src: Product) => {
    const i = products.findIndex((x) => x.id === src.id);
    if (i < 0) return;
    const next = [...products];
    const [p] = next.splice(i, 1);
    setProducts(() => next);
    showToastAction(`${src.name} deleted`, "Undo", () =>
      setProducts((list) => {
        const back = [...list];
        back.splice(Math.min(i, back.length), 0, p);
        return back;
      }),
    );
  };

  const clearFilters = () => {
    setQuery("");
    setFilter("all");
    setPage(1);
  };

  const filterItems: MenuItem[] = [
    { kind: "heading", label: "Show" },
    ...Object.entries(FILTERS).map(([k, label]) => ({
      kind: "item" as const,
      label,
      checked: k === filter,
      onSelect: () => {
        setFilter(k as FilterKey);
        setPage(1);
      },
    })),
  ];

  return (
    <>
      <div className="ov-head">
        <h1 tabIndex={-1} className="sv-title">
          E-Commerce / Store <span className="engine" title="Store engine connected">{I_CHECK_C}Medusa</span>
        </h1>
        <p>Manage your products, inventory, order lists, and payment channel toggles.</p>
      </div>

      <section className="ov-card pcard" aria-labelledby="pc-t">
        <header className="pcard-head">
          <div>
            <h2 id="pc-t">Products</h2>
            <p>Manage your product catalog. Add, edit, or update inventory and pricing.</p>
          </div>
          <div className="pcard-tools">
            <div className="sv-search">
              {icon("i-search", 14, 14, "0 0 16 16")}
              <label className="sr-only" htmlFor="prod-search">Search products</label>
              <input
                id="prod-search"
                type="search"
                placeholder="Search products by name, SKU, or category..."
                autoComplete="off"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              <MoreMenu
                ariaLabel="Filter products"
                buttonClassName="sv-filter"
                buttonContent={
                  <>
                    {I_SLIDERS}
                    {filter !== "all" ? <span className="fdot" /> : null}
                  </>
                }
                className="fmenu"
                items={filterItems}
              />
            </div>
            <button type="button" className="btn-dark sv-add" onClick={() => openDialog(null)}>
              {icon("i-plus", 14, 14, "0 0 18 18")}
              Add New Product
            </button>
          </div>
        </header>

        <div className="ptab" role="table" aria-label="Products">
          <div className="ptab-row head" role="row">
            <span role="columnheader">Product Name</span>
            <span role="columnheader">SKU</span>
            <span role="columnheader">Price</span>
            <span role="columnheader">In Stock</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Actions</span>
          </div>
          <div id="prod-rows" role="rowgroup">
            {rows.map((p) => (
              <div className="ptab-row" role="row" key={p.id}>
                <span className="pcell" role="cell">
                  <span className="pthumb" style={{ "--tb": CAT_TINT[p.cat] || "#f3ede1" } as CSSProperties} aria-hidden="true">
                    <img src={thumbSrc(p)} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} />
                  </span>
                  <span className="ptxt">
                    <strong>{p.name}</strong>
                    <small>{p.sub}</small>
                    <small className="pmeta">{p.sku} · {money(p.price)} · {p.stock} in stock</small>
                  </span>
                </span>
                <span className="c-sku" role="cell">{p.sku}</span>
                <span className="c-price" role="cell">{money(p.price)}{p.regular && p.regular > p.price ? <s>{money(p.regular)}</s> : null}</span>
                <span className="c-stock" role="cell">{p.stock}</span>
                <span className="c-status" role="cell">{statusPill(p)}</span>
                <span className="c-act" role="cell">
                  <button type="button" className="edit-btn" aria-label={`Edit ${p.name}`} onClick={() => openDialog(p)}>
                    {icon("i-edit", 11)}
                    Edit
                  </button>
                  <MoreMenu
                    ariaLabel={`More actions for ${p.name}`}
                    items={[
                      { kind: "item", label: "Edit", onSelect: () => openDialog(p) },
                      { kind: "item", label: "Duplicate", onSelect: () => duplicate(p) },
                      ...(p.status === "draft" ? [{ kind: "item" as const, label: "Publish", onSelect: () => publish(p) }] : []),
                      { kind: "item", label: p.status === "archived" ? "Restore" : "Archive", onSelect: () => toggleArchive(p) },
                      { kind: "divider" },
                      { kind: "item", label: "Delete product", danger: true, onSelect: () => remove(p) },
                    ]}
                  />
                </span>
              </div>
            ))}
            {rows.length === 0 ? (
              products.length ? (
                <div className="tab-empty">
                  <strong>No products match</strong>
                  Try another search or filter.
                  <br />
                  <button type="button" className="btn-text" onClick={clearFilters}>Clear search and filters</button>
                </div>
              ) : (
                <div className="tab-empty">
                  <strong>No products yet</strong>
                  Add your first product and it shows up here, ready to sell.
                  <br />
                  <button type="button" className="btn-dark" onClick={() => openDialog(null)}>
                    {icon("i-plus", 14, 14, "0 0 18 18")}
                    Add New Product
                  </button>
                </div>
              )
            ) : null}
          </div>
        </div>
      </section>

      <div className="sv-foot" id="prod-foot">
        <span>{list.length ? `Showing ${start + 1}-${start + rows.length} of ${list.length} products` : "Showing 0 products"}</span>
        {list.length > PER_PAGE ? (
          <Pager
            current={cur}
            pages={pages}
            onChange={(n) => {
              setPage(n);
              document.querySelector(".pcard")?.scrollIntoView({ block: "nearest" });
            }}
          />
        ) : null}
      </div>

      {dialog.open ? (
        <ProductDialog
          key={dialog.edit?.id ?? "new"}
          products={products}
          edit={dialog.edit}
          siteName={site.name}
          domain={d?.domain ?? "yourwebsite.com"}
          showToast={showToast}
          onCancel={() => setDialog({ open: false, edit: null })}
          onSubmit={(data, edit) => {
            if (edit) {
              setProducts((list) =>
                list.map((x) =>
                  x.id === edit.id
                    ? { ...x, ...data, emoji: edit.cat !== data.cat && !data.img ? CAT_EMOJI[data.cat] ?? x.emoji : x.emoji }
                    : x,
                ),
              );
              setDialog({ open: false, edit: null });
              showToast(`${data.name} updated`);
            } else {
              setProducts((list) => [
                { id: site.id + "p" + Date.now(), emoji: CAT_EMOJI[data.cat] ?? "🧺", status: "published", ...data },
                ...list,
              ]);
              clearFilters();
              setDialog({ open: false, edit: null });
              showToast(`${data.name} added to your store`);
            }
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------- add/edit product */

function ProductDialog({
  products,
  edit,
  siteName,
  domain,
  showToast,
  onCancel,
  onSubmit,
}: {
  products: Product[];
  edit: Product | null;
  siteName: string;
  domain: string;
  showToast: (text: string) => void;
  onCancel: () => void;
  onSubmit: (data: ProductDraft, edit: Product | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const seoRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  /* Set right before the effect below closes the dialog itself, so the
     (asynchronous) close event it queues is not mistaken for a user close. */
  const closingRef = useRef(false);

  const [name, setName] = useState(edit?.name ?? "");
  const [sku, setSku] = useState(edit?.sku ?? "");
  const [cat, setCat] = useState(edit?.cat ?? "");
  const [stock, setStock] = useState(edit ? String(edit.stock) : "");
  const [sale, setSale] = useState(edit ? edit.price.toFixed(2) : "");
  const [regular, setRegular] = useState(edit ? (edit.regular ?? edit.price).toFixed(2) : "");
  const [desc, setDesc] = useState(edit?.desc ?? "");
  const [img, setImg] = useState<string | null>(edit?.img ?? null);
  const [imgErr, setImgErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [skuEdited, setSkuEdited] = useState(!!edit);

  /* Product SEO: live preview card + separate editor dialog. auto.* tracks
     which fields still follow the name/description (like the prototype's
     seoAuto); when an override is cleared the stored value wins. */
  const [seo, setSeo] = useState<ProductSeo>(
    edit?.seo ?? { title: "", meta: "", slug: "", index: true, auto: { title: true, meta: true, slug: true } },
  );
  const [seoSnap, setSeoSnap] = useState<ProductSeo | null>(null);
  const seoApplyRef = useRef(false);
  const site = { name: siteName || "Your store", domain: domain || "yourwebsite.com" };
  const sName = name.trim();
  const seoVal: ProductSeo = {
    title: seo.auto.title ? (sName ? `${sName} — ${site.name}` : "") : seo.title,
    meta: seo.auto.meta ? seoTwo(desc) : seo.meta,
    slug: seo.auto.slug ? (sName ? seoSlugify(sName) : "") : seo.slug,
    index: seo.index,
    auto: { ...seo.auto },
  };
  const seoPath = seoVal.slug.trim().replace(/^\/+/, "").split("/").filter(Boolean).join(" › ");
  const seoUrl = site.domain + (seoPath ? " › " + seoPath : "");
  const seoIni = site.name.charAt(0).toUpperCase();
  const seoT = seoCut(seoVal.title, SEO_T) || "Page title";
  const seoD = seoCut(seoVal.meta, SEO_D) || "Add a description and it shows here.";

  const seoCount = (k: "title" | "meta") => {
    const v = k === "title" ? seoVal.title : seoVal.meta;
    const lim = k === "title" ? SEO_T : SEO_D;
    return { v, lim, over: v.length > lim, pct: Math.min(100, (v.length / lim) * 100) };
  };

  /* React's default client entry wraps the tree in StrictMode, whose effect
     replay does cleanup close() -> (async) close event -> onCancel -> the
     parent unmounts the dialog the instant it opens ("Add New Product closes
     immediately"). Only treat the close as a user close when we did not just
     close the dialog ourselves. */
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    nameRef.current?.focus();
    const onCancel = (e: Event) => {
      if (seoRef.current?.open) return;
      e.preventDefault();
      closeAnimated();
    };
    d.addEventListener("cancel", onCancel);
    return () => {
      d.removeEventListener("cancel", onCancel);
      if (d.open) closingRef.current = true;
      d.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    onCancel();
  };

  /* Plays the pd-out slide (see overview.css) before the native close, so the
     dialog slides back out to the right instead of vanishing. */
  const closeAnimated = (after?: () => void) => {
    const d = ref.current;
    if (!d || !d.open) {
      after?.();
      return;
    }
    if (d.classList.contains("closing")) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      d.close();
      after?.();
      return;
    }
    d.classList.add("closing");
    d.addEventListener(
      "animationend",
      () => {
        d.classList.remove("closing");
        d.close();
        after?.();
      },
      { once: true },
    );
  };

  const clearErr = (id: string) => setErrors((e) => (e[id] ? { ...e, [id]: "" } : e));

  const take = (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      setImgErr("Use a JPG or PNG image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImgErr("That image is over 5MB. Pick a smaller one.");
      return;
    }
    setImgErr("");
    const r = new FileReader();
    r.onload = () => setImg(String(r.result));
    r.readAsDataURL(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedSku = sku.trim().replace(/^-+|-+$/g, "");
    const saleNum = parseFloat(sale);
    const regularNum = parseFloat(regular);
    const next: Record<string, string> = {};
    let first: string | null = null;
    const bad = (id: string, msg: string) => {
      next[id] = msg;
      first ??= id;
    };
    if (!trimmedName) bad("pf-name", "Give the product a name.");
    if (!trimmedSku) bad("pf-sku", "Add a SKU so you can track stock.");
    else if (products.some((x) => x !== edit && x.sku.toLowerCase() === trimmedSku.toLowerCase()))
      bad("pf-sku", `${trimmedSku} is already used by another product.`);
    if (!cat) bad("pf-cat", "Pick a category.");
    if (!/^\d+$/.test(stock.trim())) bad("pf-stock", "Enter how many you have in stock (0 or more).");
    if (!(saleNum > 0)) bad("pf-sale", "Enter a sale price above 0, e.g. 4.99.");
    if (!(regularNum > 0)) bad("pf-regular", "Enter a regular price above 0, e.g. 4.99.");
    else if (saleNum > regularNum) bad("pf-sale", "The sale price can’t be higher than the regular price.");
    setErrors(next);
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    closingRef.current = true;
    closeAnimated(() =>
      onSubmit(
        {
          name: trimmedName,
          sku: trimmedSku,
          cat,
          stock: Number(stock),
          price: Math.round(saleNum * 100) / 100,
          regular: Math.round(regularNum * 100) / 100,
          desc: desc.trim(),
          img,
          sub: desc.trim() ? desc.trim().split("\n")[0].slice(0, 40) : edit ? edit.sub : cat,
          seo: seoVal,
        },
        edit,
      ),
    );
  };

  const openSeo = () => {
    seoApplyRef.current = false;
    setSeoSnap({ title: seoVal.title, meta: seoVal.meta, slug: seoVal.slug, index: seo.index, auto: { ...seo.auto } });
    seoRef.current?.showModal();
    seoRef.current?.querySelector<HTMLInputElement>("#pf-seo-title")?.focus();
  };
  const closeSeo = () => {
    if (!seoApplyRef.current && seoSnap) setSeo(seoSnap);
  };

  const err = (id: string) => errors[id] || "";

  return (
    <>
    <dialog
      id="dlg-product"
      className="modal modal-product"
      ref={ref}
      aria-labelledby="pf-title"
      aria-describedby="pf-sub"
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAnimated();
      }}
    >
      <form noValidate onSubmit={submit}>
        <div className="pf-head">
          <div>
            <h2 id="pf-title">{edit ? "Edit Product" : "Add Product"}</h2>
            <p id="pf-sub">{edit ? "Update this product’s details" : "Add a new product to your store"}</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => closeAnimated()}>
            {icon("i-close", 18, 18, "0 0 16 16")}
          </button>
        </div>

        <label
          className={`pf-drop${img ? " has-img" : ""}${drag ? " drag" : ""}`}
          id="pf-drop"
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            take(e.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            aria-label="Upload product image"
            onChange={(e) => {
              take(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <svg className="pf-dash" aria-hidden="true">
            <rect x=".5" y=".5" rx="12" ry="12" />
          </svg>
          <span id="pf-drop-body" style={{ display: "contents" }}>
            {img ? (
              <img src={img} alt="Product image preview" />
            ) : (
              <>
                {I_CLOUD}
                <strong>Upload product image</strong>
                <small>Drag and drop an image, or click to browse</small>
                <small>JPG, PNG (max 5MB)</small>
              </>
            )}
          </span>
        </label>

        <div className="pf-imgbar" hidden={!img}>
          <button type="button" className="btn-text" onClick={() => fileRef.current?.click()}>Replace image</button>
          <button type="button" className="btn-text" onClick={() => setImg(null)}>Remove</button>
        </div>
        <p className="pf-err" role="alert" hidden={!imgErr} style={{ textAlign: "center" }}>{imgErr}</p>

        <div className="pf-fields pf-grid">
          <div className="pf-field">
            <label htmlFor="pf-name">Product Name<span className="req" aria-hidden="true">*</span></label>
            <input
              ref={nameRef}
              className="pf-input"
              id="pf-name"
              maxLength={80}
              autoComplete="off"
              placeholder="e.g. Organic Farm Eggs"
              required
              value={name}
              aria-invalid={!!err("pf-name")}
              aria-describedby={err("pf-name") ? "pf-name-err" : undefined}
              onChange={(e) => {
                clearErr("pf-name");
                setName(e.target.value);
                if (!skuEdited) setSku(abbr(e.target.value));
              }}
            />
            <p className="pf-err" id="pf-name-err" role="alert" hidden={!err("pf-name")}>{err("pf-name")}</p>
          </div>

          <div className="pf-field">
            <label htmlFor="pf-sku">SKU<span className="req" aria-hidden="true">*</span></label>
            <input
              className="pf-input"
              id="pf-sku"
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. OF-EGG-12"
              required
              value={sku}
              aria-invalid={!!err("pf-sku")}
              aria-describedby={err("pf-sku") ? "pf-sku-err" : undefined}
              onChange={(e) => {
                setSkuEdited(true);
                clearErr("pf-sku");
                setSku(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "-").replace(/-{2,}/g, "-"));
              }}
            />
            <p className="pf-err" id="pf-sku-err" role="alert" hidden={!err("pf-sku")}>{err("pf-sku")}</p>
          </div>

          <div className="pf-field">
            <label htmlFor="pf-cat">Category<span className="req" aria-hidden="true">*</span></label>
            <select
              className="pf-input"
              id="pf-cat"
              required
              value={cat}
              aria-invalid={!!err("pf-cat")}
              aria-describedby={err("pf-cat") ? "pf-cat-err" : undefined}
              onChange={(e) => {
                clearErr("pf-cat");
                setCat(e.target.value);
              }}
            >
              <option value="" disabled>Select category</option>
              {CATS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <p className="pf-err" id="pf-cat-err" role="alert" hidden={!err("pf-cat")}>{err("pf-cat")}</p>
          </div>

          <div className="pf-field">
            <label htmlFor="pf-stock">Stock Quantity<span className="req" aria-hidden="true">*</span></label>
            <input
              className="pf-input"
              id="pf-stock"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g 120"
              required
              value={stock}
              aria-invalid={!!err("pf-stock")}
              aria-describedby={err("pf-stock") ? "pf-stock-err" : undefined}
              onChange={(e) => {
                clearErr("pf-stock");
                setStock(e.target.value.replace(/\D/g, ""));
              }}
            />
            <p className="pf-err" id="pf-stock-err" role="alert" hidden={!err("pf-stock")}>{err("pf-stock")}</p>
          </div>

          <div className="pf-field">
            <label htmlFor="pf-sale">Sale Price<span className="req" aria-hidden="true">*</span></label>
            <div className="pf-box" aria-invalid={!!err("pf-sale")}>
              <span aria-hidden="true">$</span>
              <input
                id="pf-sale"
                inputMode="decimal"
                autoComplete="off"
                placeholder="e.g $4.99"
                required
                value={sale}
                aria-describedby={err("pf-sale") ? "pf-sale-err" : undefined}
                onChange={(e) => {
                  clearErr("pf-sale");
                  setSale(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"));
                }}
              />
            </div>
            <p className="pf-err" id="pf-sale-err" role="alert" hidden={!err("pf-sale")}>{err("pf-sale")}</p>
          </div>

          <div className="pf-field">
            <label htmlFor="pf-regular">Regular Price<span className="req" aria-hidden="true">*</span></label>
            <div className="pf-box" aria-invalid={!!err("pf-regular")}>
              <span aria-hidden="true">$</span>
              <input
                id="pf-regular"
                inputMode="decimal"
                autoComplete="off"
                placeholder="e.g $4.99"
                required
                value={regular}
                aria-describedby={err("pf-regular") ? "pf-regular-err" : undefined}
                onChange={(e) => {
                  clearErr("pf-regular");
                  setRegular(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"));
                }}
              />
            </div>
            <p className="pf-err" id="pf-regular-err" role="alert" hidden={!err("pf-regular")}>{err("pf-regular")}</p>
          </div>

          <div className="pf-field full">
            <label htmlFor="pf-desc">Description</label>
            <textarea
              className="pf-input"
              id="pf-desc"
              maxLength={500}
              placeholder="Add product description..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <p className="pf-count" aria-live="polite">{desc.length}/500</p>
          </div>

          <div className="pf-seo full">
            <div className="ps-head">
              <span className="ps-badge" aria-hidden="true">{icon("i-search", 16, 16, "0 0 16 16")}</span>
              <span className="ps-label">Search engine listing<small>How this product appears on Google</small></span>
              <button type="button" className="ps-edit" id="pf-seo-open" onClick={openSeo}>
                {icon("i-edit", 12)}
                Edit SEO
              </button>
            </div>
            <div className="ps-card">
              <div className="ps-top">
                <span className="gp-fav" id="ps-fav">{seoIni}</span>
                <span className="ps-site"><b id="ps-site">{site.name}</b><span id="ps-url">{seoUrl}</span></span>
                <span className={`ps-pill${seo.index ? "" : " off"}`}>{seo.index ? "Visible on Google" : "Hidden from Google"}</span>
              </div>
              <div className="ps-t" id="ps-t">{seoT}</div>
              <div className="ps-d" id="ps-d">{seoD}</div>
            </div>
          </div>
        </div>

        <div className="pf-foot">
          <button type="button" className="btn-outline pf-btn" onClick={() => ref.current?.close()}>Cancel</button>
          <button type="submit" className="btn-primary pf-btn">{edit ? "Save Changes" : "Add Product"}</button>
        </div>
      </form>
    </dialog>

    <dialog
      className="modal modal-seo"
      ref={seoRef}
      aria-labelledby="seo-title"
      onClose={closeSeo}
      onClick={(e) => {
        if (e.target === e.currentTarget) seoRef.current?.close();
      }}
    >
      <div className="seo-head">
        <div><h2 id="seo-title">Search engine listing</h2><p>Control how this product looks on Google.</p></div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={() => seoRef.current?.close()}>
          {icon("i-close", 18, 18, "0 0 16 16")}
        </button>
      </div>
      <div className="seo-body">
        <div className="seo-stage" aria-label="Google preview">
          <div className="seo-q">{icon("i-search", 14, 14, "0 0 16 16")}<span>{`buy ${sName.toLowerCase() || "your product"} online`}</span></div>
          <div className={`seo-res${seo.index ? "" : " off"}`}>
            <div className="ps-top">
              <span className="gp-fav">{seoIni}</span>
              <span className="ps-site"><b>{site.name}</b><span>{seoUrl}</span></span>
            </div>
            <div className="seo-rt">{seoT}</div>
            <div className="seo-rd">{seoD}</div>
          </div>
          <p className="seo-note" hidden={seo.index}>This page is hidden from Google. People with the link can still open it.</p>
        </div>
        <div className="seo-fields">
          <div className="pf-field">
            <div className="seo-lr">
              <label htmlFor="pf-seo-title">Page title</label>
              <span className={seoCount("title").over ? "over" : ""}>{seoCount("title").v.length} / {SEO_T}</span>
            </div>
            <input
              className="pf-input"
              id="pf-seo-title"
              autoComplete="off"
              placeholder="Buy Fresh Whole Broiler Chicken | Debaz Farm"
              value={seoVal.title}
              onChange={(e) =>
                setSeo((s) => ({ ...s, title: e.target.value, auto: { ...s.auto, title: false } }))
              }
            />
            <div className="seo-meter"><i className={seoCount("title").over ? "over" : ""} style={{ width: `${seoCount("title").pct}%` }} /></div>
          </div>
          <div className="pf-field">
            <div className="seo-lr">
              <label htmlFor="pf-seo-meta">Meta description</label>
              <span className={seoCount("meta").over ? "over" : ""}>{seoCount("meta").v.length} / {SEO_D}</span>
            </div>
            <textarea
              className="pf-input"
              id="pf-seo-meta"
              placeholder="A short line that makes people want to click"
              value={seoVal.meta}
              onChange={(e) =>
                setSeo((s) => ({ ...s, meta: e.target.value, auto: { ...s.auto, meta: false } }))
              }
            />
            <div className="seo-meter"><i className={seoCount("meta").over ? "over" : ""} style={{ width: `${seoCount("meta").pct}%` }} /></div>
          </div>
          <div className="pf-field">
            <div className="seo-lr"><label htmlFor="pf-seo-slug">URL slug</label></div>
            <div className="pf-box">
              <span className="seo-dom">{site.domain}</span>
              <input
                id="pf-seo-slug"
                autoComplete="off"
                spellCheck={false}
                placeholder="/products/whole-broiler-chicken"
                value={seoVal.slug}
                onChange={(e) =>
                  setSeo((s) => ({ ...s, slug: e.target.value, auto: { ...s.auto, slug: false } }))
                }
              />
            </div>
          </div>
          <label className="seo-switch">
            <span><b>Show on search engines</b><small>Turn off to hide this page from Google. It still works for people who have the link.</small></span>
            <input type="checkbox" role="switch" checked={seo.index} onChange={(e) => setSeo((s) => ({ ...s, index: e.target.checked }))} />
          </label>
        </div>
      </div>
      <div className="seo-foot">
        <button
          type="button"
          className="btn-text"
          onClick={() => setSeo((s) => ({ ...s, auto: { title: true, meta: true, slug: true } }))}
        >
          Reset to auto-generated
        </button>
        <span className="seo-actions">
          <button type="button" className="btn-outline pf-btn" onClick={() => seoRef.current?.close()}>Cancel</button>
          <button
            type="button"
            className="btn-primary pf-btn"
            onClick={() => {
              seoApplyRef.current = true;
              seoRef.current?.close();
              showToast("Search listing updated");
            }}
          >
            Save changes
          </button>
        </span>
      </div>
    </dialog>
    </>
  );
}

/* -------------------------------------------------------- website pages */

export function WebsitePagesView({
  site,
  d,
  pages,
  setPages,
  showToast,
  showToastAction,
}: {
  site: SiteLite;
  d: { live: boolean; domain: string };
  pages: WebPage[];
  setPages: (updater: (list: WebPage[]) => WebPage[]) => void;
  showToast: (text: string) => void;
  showToastAction: (text: string, label: string, action: () => void) => void;
}) {
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const list = pages.filter((p) => !q || p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q));

  const duplicate = (src: WebPage) => {
    setPages((list) => {
      const i = list.findIndex((x) => x.id === src.id);
      if (i < 0) return list;
      const base = src.path === "/" ? "/home" : src.path;
      let path = base + "-copy";
      let n = 2;
      while (list.some((x) => x.path === path)) path = `${base}-copy-${n++}`;
      const next = [...list];
      next.splice(i + 1, 0, { ...src, id: site.id + "w" + Date.now(), name: src.name + " copy", path, status: "draft" });
      return next;
    });
    showToast(`${src.name} duplicated as a draft`);
  };

  const toggleStatus = (src: WebPage) => {
    const now: "published" | "draft" = src.status === "draft" ? "published" : "draft";
    setPages((list) => list.map((x) => (x.id === src.id ? { ...x, status: now } : x)));
    showToast(`${src.name} ${now === "draft" ? "unpublished" : "published"}`);
  };

  const remove = (src: WebPage) => {
    const i = pages.findIndex((x) => x.id === src.id);
    if (i < 0) return;
    const next = [...pages];
    const [p] = next.splice(i, 1);
    setPages(() => next);
    showToastAction(`${p.name} deleted`, "Undo", () =>
      setPages((list) => {
        const back = [...list];
        back.splice(Math.min(i, back.length), 0, p);
        return back;
      }),
    );
  };

  return (
    <>
      <div className="sv-head">
        <div className="ov-head">
          <h1 tabIndex={-1}>Pages</h1>
          <p>Manage your page tree, SEO titles, subpaths, and publishing status.</p>
        </div>
        <div className="wp-tools">
          <div className="sv-search">
            {icon("i-search", 14, 14, "0 0 16 16")}
            <label className="sr-only" htmlFor="page-search">Search pages</label>
            <input
              id="page-search"
              type="search"
              placeholder="Search pages by name or path..."
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button type="button" className="btn-dark sv-add" onClick={() => setAddOpen(true)}>
            {icon("i-plus", 14, 14, "0 0 18 18")}
            Add New Page
          </button>
        </div>
      </div>

      <section className="ov-card wp-card" aria-label="Pages">
        <div className="wtab" role="table" aria-label="Pages">
          <div className="wrow head" role="row">
            <span role="columnheader">Page Name/Title</span>
            <span role="columnheader">URL Path</span>
            <span role="columnheader">Layout Template</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Actions</span>
          </div>
          <div id="wp-rows" role="rowgroup">
            {list.map((p) => {
              const items: MenuItem[] = [
                ...(p.status === "published" && d.live
                  ? [{ kind: "item" as const, label: "View live page", href: `https://${d.domain}${p.path === "/" ? "" : p.path}` }]
                  : []),
                { kind: "item", label: p.status === "draft" ? "Publish" : "Unpublish", onSelect: () => toggleStatus(p) },
                { kind: "item", label: "Duplicate", onSelect: () => duplicate(p) },
                ...(p.path === "/"
                  ? []
                  : [{ kind: "divider" as const }, { kind: "item" as const, label: "Delete page", danger: true, onSelect: () => remove(p) }]),
              ];
              return (
                <div className="wrow" role="row" key={p.id}>
                  <span className="wname" role="cell">
                    <span>
                      <strong>{p.name}</strong>
                      <span className="wmeta">{p.path} · {p.tpl}</span>
                    </span>
                  </span>
                  <span className="w-path" role="cell">{p.path}</span>
                  <span className="w-tpl" role="cell">{p.tpl}</span>
                  <span className="w-status" role="cell">
                    <span className={`wst ${p.status}`}>{p.status === "published" ? "Published" : "Draft"}</span>
                  </span>
                  <span className="c-act" role="cell">
                    <button
                      type="button"
                      className="edit-btn"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => showToast(`Opening ${p.name} in the page editor`)}
                    >
                      {icon("i-edit", 12)}
                      Edit
                    </button>
                    <MoreMenu ariaLabel={`More actions for ${p.name}`} items={items} />
                  </span>
                </div>
              );
            })}
            {list.length === 0 ? (
              <div className="tab-empty">
                <strong>No pages match</strong>
                Try another name or path.
                <br />
                <button type="button" className="btn-text" onClick={() => setQuery("")}>Clear search</button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {addOpen ? (
        <PageDialog
          pages={pages}
          onCancel={() => setAddOpen(false)}
          onSubmit={(data) => {
            setPages((list) => [...list, { id: site.id + "w" + Date.now(), status: "draft", ...data, ic: data.tpl === "Contact Form Layout" ? "contact" : data.tpl === "E-Commerce Grid" ? "shop" : "doc" }]);
            setQuery("");
            setAddOpen(false);
            showToastAction(`${data.name} added as a draft`, "Edit page", () => showToast(`Opening ${data.name} in the page editor`));
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------- add page */

function PageDialog({
  pages,
  onCancel,
  onSubmit,
}: {
  pages: WebPage[];
  onCancel: () => void;
  onSubmit: (data: { name: string; path: string; tpl: string }) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [tpl, setTpl] = useState("Standard Content");
  const [pathEdited, setPathEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* Same StrictMode-aware close guard as ProductDialog: the effect cleanup's
     programmatic close() must not bounce back through onClose and unmount the
     dialog the instant it opens. */
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    nameRef.current?.focus();
    return () => {
      if (d.open) closingRef.current = true;
      d.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    onCancel();
  };

  const clearErr = (id: string) => setErrors((e) => (e[id] ? { ...e, [id]: "" } : e));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const fullPath = "/" + path.trim().replace(/^\/+|\/+$/g, "");
    const next: Record<string, string> = {};
    let first: string | null = null;
    const bad = (id: string, msg: string) => {
      next[id] = msg;
      first ??= id;
    };
    if (!trimmedName) bad("pg-name", "Give the page a name.");
    if (fullPath === "/") bad("pg-path", "Add a path, e.g. our-story.");
    else if (pages.some((x) => x.path === fullPath)) bad("pg-path", `${fullPath} is already used by another page.`);
    setErrors(next);
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    onSubmit({ name: trimmedName, path: fullPath, tpl });
  };

  const err = (id: string) => errors[id] || "";

  return (
    <dialog
      className="modal modal-product"
      ref={ref}
      aria-labelledby="pg-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <form noValidate onSubmit={submit}>
        <div className="pf-head">
          <div>
            <h2 id="pg-title">Add Page</h2>
            <p>Add a new page to this site. It starts as a draft.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
            {icon("i-close", 18, 18, "0 0 16 16")}
          </button>
        </div>

        <div className="pf-fields">
          <div className="pf-field">
            <label htmlFor="pg-name">Page Name<span className="req" aria-hidden="true">*</span></label>
            <input
              ref={nameRef}
              className="pf-input"
              id="pg-name"
              maxLength={60}
              autoComplete="off"
              placeholder="e.g. Our Story"
              required
              value={name}
              aria-invalid={!!err("pg-name")}
              aria-describedby={err("pg-name") ? "pg-name-err" : undefined}
              onChange={(e) => {
                clearErr("pg-name");
                setName(e.target.value);
                if (!pathEdited) setPath(slugify(e.target.value));
              }}
            />
            <p className="pf-err" id="pg-name-err" role="alert" hidden={!err("pg-name")}>{err("pg-name")}</p>
          </div>

          <div className="pf-field">
            <label htmlFor="pg-path">URL Path<span className="req" aria-hidden="true">*</span></label>
            <div className="pf-box" aria-invalid={!!err("pg-path")}>
              <span aria-hidden="true">/</span>
              <input
                id="pg-path"
                autoComplete="off"
                spellCheck={false}
                placeholder="our-story"
                required
                value={path}
                aria-describedby={err("pg-path") ? "pg-path-err" : undefined}
                onChange={(e) => {
                  setPathEdited(true);
                  clearErr("pg-path");
                  setPath(e.target.value.toLowerCase().replace(/[^a-z0-9/-]/g, "-").replace(/-{2,}/g, "-"));
                }}
              />
            </div>
            <p className="pf-err" id="pg-path-err" role="alert" hidden={!err("pg-path")}>{err("pg-path")}</p>
          </div>

          <div className="pf-field">
            <label htmlFor="pg-tpl">Layout Template<span className="req" aria-hidden="true">*</span></label>
            <select className="pf-input" id="pg-tpl" value={tpl} onChange={(e) => setTpl(e.target.value)}>
              {PAGE_TPLS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pf-foot">
          <button type="button" className="btn-outline pf-btn" onClick={() => ref.current?.close()}>Cancel</button>
          <button type="submit" className="btn-primary pf-btn">Add Page</button>
        </div>
      </form>
    </dialog>
  );
}

/* =================================================================
   Content (#/overview/content): article list + add / edit dialog with the
   Content Body rich-text editor and its own SEO sub-dialog — from
   renderContentView() / paintArticles() / openArticle() in wp.html.
   ================================================================= */

const ART_STATUS: Record<string, string> = { published: "Published", draft: "Draft" };
type ArtFilter = "all" | "published" | "draft";

const ART_FILTER_ICON = (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M2.5 5h13M5 9h8M7.5 13h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const I_DOC_16 = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4 2.5h5.5L12.5 5.5v8H4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M6 8h4.5M6 10.5h4.5M6 5.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
const I_PENCIL_12 = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <use href="#i-edit" />
  </svg>
);

const ART_PER = 8;

export function ContentView({
  site,
  d,
  articles,
  setArticles,
  showToast,
  showToastAction,
}: {
  site: SiteLite & { name: string };
  d: { live: boolean; domain: string };
  articles: Article[];
  setArticles: (updater: (list: Article[]) => Article[]) => void;
  showToast: (text: string) => void;
  showToastAction: (text: string, label: string, action: () => void) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ArtFilter>("all");
  const [page, setPage] = useState(1);
  const [dlg, setDlg] = useState<{ edit: Article | null } | null>(null);

  const q = query.trim().toLowerCase();
  const list = articles.filter(
    (a) => (filter === "all" || a.status === filter) && (!q || [a.title, a.slug, a.author].some((x) => x.toLowerCase().includes(q))),
  );
  const pages = Math.max(1, Math.ceil(list.length / ART_PER));
  const cur = Math.min(Math.max(1, page), pages);
  const start = (cur - 1) * ART_PER;
  const rows = list.slice(start, start + ART_PER);

  const filterItems: MenuItem[] = [
    { kind: "heading", label: "Status" },
    { kind: "item", label: "All statuses", checked: filter === "all", onSelect: () => { setFilter("all"); setPage(1); } },
    ...Object.entries(ART_STATUS).map(([k, l]) => ({
      kind: "item" as const,
      label: l,
      checked: filter === k,
      onSelect: () => { setFilter(k as ArtFilter); setPage(1); },
    })),
  ];

  const toggleStatus = (src: Article) => {
    const now: "published" | "draft" = src.status === "draft" ? "published" : "draft";
    setArticles((all) => all.map((x) => (x.id === src.id ? { ...x, status: now, date: now === "published" ? Date.now() : x.date } : x)));
    showToast(`${src.title} ${now === "published" ? "published" : "moved to drafts"}`);
  };

  const duplicate = (src: Article) => {
    setArticles((all) => {
      const i = all.findIndex((x) => x.id === src.id);
      if (i < 0) return all;
      let slug = src.slug + "-copy";
      let n = 2;
      while (all.some((x) => x.slug === slug)) slug = `${src.slug}-copy-${n++}`;
      const next = [...all];
      next.splice(i + 1, 0, { ...src, id: site.id + "a" + Date.now(), title: src.title + " (copy)", slug, status: "draft" });
      return next;
    });
    showToast(`${src.title} duplicated as a draft`);
  };

  const remove = (src: Article) => {
    const i = articles.findIndex((x) => x.id === src.id);
    if (i < 0) return;
    const next = [...articles];
    const [a] = next.splice(i, 1);
    setArticles(() => next);
    showToastAction(`${a.title} deleted`, "Undo", () =>
      setArticles((all) => {
        const back = [...all];
        back.splice(Math.min(i, back.length), 0, a);
        return back;
      }),
    );
  };

  return (
    <>
      <div className="ov-head">
        <h1 tabIndex={-1}>Content</h1>
        <p>Manage articles, farm updates, and resource guides.</p>
      </div>
      <section className="ov-card acard" aria-labelledby="ac-t">
        <header className="acard-head">
          <h2 id="ac-t">Article Management</h2>
          <p>Create, edit, and manage your blog posts, announcements, and other content. Each article includes built-in SEO and metadata fields to help your content get discovered.</p>
        </header>
        <div className="acard-tools">
          <div className="sv-search">
            {icon("i-search", 14, 14, "0 0 16 16")}
            <label className="sr-only" htmlFor="art-search">Search articles</label>
            <input
              id="art-search"
              type="search"
              placeholder="Search articles by title, slug, or author..."
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <MoreMenu
            ariaLabel="Filter articles by status"
            className="fmenu"
            buttonClassName="ofilter-btn"
            buttonContent={
              <>
                {ART_FILTER_ICON}
                <span className="lbl">{filter === "all" ? "Filter by Status" : `Status: ${ART_STATUS[filter]}`}</span>
                {CHEV_D}
              </>
            }
            items={filterItems}
          />
          <button type="button" className="btn-dark sv-add" onClick={() => setDlg({ edit: null })}>
            {icon("i-plus", 14, 14, "0 0 18 18")}
            Add New Article
          </button>
        </div>
        <div className="atab" role="table" aria-label="Articles">
          <div className="arow head" role="row">
            <span role="columnheader">Article Title &amp; Slug</span>
            <span role="columnheader">Author</span>
            <span role="columnheader">Published Date</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Actions</span>
          </div>
          <div id="art-rows" role="rowgroup">
            {rows.map((a) => {
              const pub = a.status === "published";
              const items: MenuItem[] = [
                ...(pub && d.live ? [{ kind: "item" as const, label: "View live article", href: `https://${d.domain}/blog/${a.slug}` }] : []),
                { kind: "item", label: pub ? "Unpublish" : "Publish now", onSelect: () => toggleStatus(a) },
                { kind: "item", label: "Duplicate", onSelect: () => duplicate(a) },
                { kind: "divider" as const },
                { kind: "item" as const, label: "Delete article", danger: true, onSelect: () => remove(a) },
              ];
              return (
                <div className="arow" role="row" key={a.id}>
                  <span className="acell" role="cell">
                    <span className="athumb" style={{ ["--tb" as string]: a.tint }} aria-hidden="true">
                      {a.emoji}
                      {a.img || a.photo ? <img src={a.img || photoUrl(a.photo!)} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} /> : null}
                    </span>
                    <span className="atxt">
                      <strong>{a.title}</strong>
                      <code>/blog/{a.slug}</code>
                      {a.bodySnip ? (
                        <span className="ab-snip a-snip" dangerouslySetInnerHTML={{ __html: a.bodySnip }} />
                      ) : (
                        <small>{a.excerpt || "No excerpt yet."}</small>
                      )}
                      <small className="pmeta">
                        {a.author} · {pub ? fmtDate(a.date) : "Not published"}
                      </small>
                    </span>
                  </span>
                  <span className="a-author" role="cell">{a.author}</span>
                  <span className={`a-date${pub ? "" : " none"}`} role="cell">
                    {pub ? (
                      <>
                        <span>{fmtDate(a.date)}</span>
                        <span>{fmtTime(a.date)}</span>
                      </>
                    ) : (
                      <span>Not published</span>
                    )}
                  </span>
                  <span className="a-status" role="cell">
                    <span className={`cpill${pub ? "" : " off"}`}>{ART_STATUS[a.status]}</span>
                  </span>
                  <span className="c-act" role="cell">
                    <button type="button" className="edit-btn" aria-label={`Edit ${a.title}`} onClick={() => setDlg({ edit: a })}>
                      {icon("i-edit", 13)}
                      Edit
                    </button>
                    <MoreMenu ariaLabel={`More actions for ${a.title}`} items={items} />
                  </span>
                </div>
              );
            })}
            {rows.length === 0 ? (
              articles.length ? (
                <div className="tab-empty">
                  <strong>No articles match</strong>
                  Try another search or status.
                  <br />
                  <button type="button" className="btn-text" onClick={() => { setQuery(""); setFilter("all"); setPage(1); }}>
                    Clear search and filters
                  </button>
                </div>
              ) : (
                <div className="tab-empty">
                  <strong>No articles yet</strong>
                  Write your first post and it shows up here.
                  <br />
                  <button type="button" className="btn-dark" onClick={() => setDlg({ edit: null })}>
                    {icon("i-plus", 14, 14, "0 0 18 18")}
                    Add New Article
                  </button>
                </div>
              )
            ) : null}
          </div>
        </div>
      </section>
      <div className="sv-foot">
        <span>
          {list.length
            ? `Showing ${start + 1}–${start + rows.length} of ${list.length} ${list.length === 1 ? "article" : "articles"}`
            : "Showing 0 articles"}
        </span>
        <Pager current={cur} pages={pages} onChange={setPage} label="Article pages" />
      </div>

      {dlg ? (
        <ArticleDialog
          key={dlg.edit?.id ?? "new"}
          site={site}
          articles={articles}
          edit={dlg.edit}
          onCancel={() => setDlg(null)}
          onSubmit={(data, edit) => {
            if (edit) {
              setArticles((all) => all.map((x) => (x.id === edit.id ? { ...x, ...data } : x)));
              setDlg(null);
              showToast(`${data.title} updated`);
            } else {
              setArticles((all) => [
                { id: site.id + "a" + Date.now(), date: Date.now(), emoji: "📝", tint: "#efece4", photo: null, ...data },
                ...all,
              ]);
              setQuery("");
              setFilter("all");
              setPage(1);
              setDlg(null);
              showToast(data.status === "published" ? `${data.title} published` : `${data.title} saved as a draft`);
            }
          }}
          showToast={showToast}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------- add/edit article dialog */

type ArticleDraft = {
  title: string;
  slug: string;
  author: string;
  status: "published" | "draft";
  excerpt: string;
  excerptCustom: boolean;
  img: string | null;
  body: string;
  bodySnip: string;
  seo: ArticleSeo;
  date?: number;
};

/* fmtSnip(): a browser-only, attribute-stripped copy of the article HTML for
   previews — keeps bold/italic/underline/headings/lists, drops images. */
function fmtSnip(html: string) {
  const box = document.createElement("div");
  box.innerHTML = html || "";
  box.querySelectorAll("img, script, style, iframe").forEach((n) => n.remove());
  box.querySelectorAll("*").forEach((n) => {
    const el = n as HTMLElement;
    const wrap = (t: string) => {
      const w = document.createElement(t);
      el.parentNode?.insertBefore(w, el);
      w.appendChild(el);
    };
    const fw = el.style?.fontWeight ?? "";
    if (el.style && !/^(B|STRONG|H\d)$/.test(el.tagName) && /^(bold|[6-9]00)$/.test(fw)) wrap("b");
    if (el.style && !/^(I|EM)$/.test(el.tagName) && el.style.fontStyle === "italic") wrap("i");
    if (el.style && el.tagName !== "U" && /underline/.test((el.style.textDecoration || "") + (el.style.textDecorationLine || ""))) wrap("u");
  });
  box.querySelectorAll("*").forEach((n) => [...n.attributes].forEach((a) => n.removeAttribute(a.name)));
  [...box.childNodes].forEach((n) => {
    if (n.nodeType === 1 && !(n as Element).textContent?.trim()) n.remove();
  });
  return box.innerHTML;
}

const textOf = (html: string) => {
  const box = document.createElement("div");
  box.innerHTML = html || "";
  return (box.innerText || box.textContent || "").replace(/\s+/g, " ").trim();
};

function ArticleDialog({
  site,
  articles,
  edit,
  onCancel,
  onSubmit,
  showToast,
}: {
  site: SiteLite & { name: string };
  articles: Article[];
  edit: Article | null;
  onCancel: () => void;
  onSubmit: (data: ArticleDraft, edit: Article | null) => void;
  showToast: (text: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDialogElement>(null);
  const seoRef = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);
  const seoClosingRef = useRef(false);
  const bodyClosingRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const aeRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(edit?.title ?? "");
  const [slug, setSlug] = useState(edit?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(!!edit);
  const [author, setAuthor] = useState(edit?.author ?? AUTHOR_ROLES[0]);
  const [status, setStatus] = useState<"published" | "draft">(edit?.status ?? "published");
  const [img, setImg] = useState<string | null>(edit?.img ?? null);
  const [imgErr, setImgErr] = useState("");
  const [body, setBody] = useState<string>(edit ? (edit.body || (edit.excerpt ? `<p>${edit.excerpt}</p>` : "")) : "");
  const [aeText, setAeText] = useState(() => (edit ? textOf(edit.body || "") : ""));
  const [excerpt, setExcerpt] = useState(edit?.excerpt ?? "");
  const [exAuto, setExAuto] = useState(!(edit?.excerptCustom));
  const [aeErr, setAeErr] = useState("");
  const [bodyOpen, setBodyOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [seo, setSeo] = useState<ArticleSeo>(
    edit?.seo ?? { title: "", meta: "", slug: `/blog/${edit?.slug ?? ""}`, index: true, auto: { title: true, meta: true }, ogUse: true, og: null },
  );

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    nameRef.current?.focus();
    return () => {
      if (d.open) closingRef.current = true;
      d.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    onCancel();
  };

  const slugPath = () => "/blog/" + slug.trim().replace(/^-+|-+$/g, "");
  const articleText = () => (aeRef.current ? (aeRef.current.innerText || "").replace(/\s+/g, " ").trim() : aeText);

  /* Excerpt fills from the first sentences of the body until the owner types
     their own — arExFill() in wp.html. */
  const exFill = (text: string) => {
    if (exAuto) setExcerpt(seoTwo(text).slice(0, 200));
  };

  const fillSeo = (text: string, ex: string) => {
    setSeo((s) => ({
      ...s,
      title: s.auto.title && name.trim() ? name.trim() + " — " + site.name : s.title,
      meta: s.auto.meta ? seoTwo(ex.trim() || text).slice(0, 200) : s.meta,
      slug: s.slug || slugPath(),
    }));
  };

  const takeImg = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setImgErr("Use a JPG, PNG or WebP image.");
    if (file.size > 5 * 1024 * 1024) return setImgErr("That image is over 5MB. Pick a smaller one.");
    setImgErr("");
    const r = new FileReader();
    r.onload = () => setImg(String(r.result));
    r.readAsDataURL(file);
  };

  const clearErr = (id: string) => setErrs((e) => (e[id] ? { ...e, [id]: "" } : e));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = name.trim();
    const sl = slug.trim().replace(/^-+|-+$/g, "");
    const auth = author.trim();
    let first: string | null = null;
    const bad = (id: string, msg: string) => {
      setErrs((s) => ({ ...s, [id]: msg }));
      first = first ?? id;
    };
    setErrs({});
    if (!title) bad("ar-name", "Give the article a title.");
    if (!sl) bad("ar-slug", "Add a URL slug, e.g. 5-tips-raising-broilers.");
    else if (articles.some((x) => x !== edit && x.slug === sl)) bad("ar-slug", `/blog/${sl} is already used by another article.`);
    if (!auth) bad("ar-author", "Pick who this article is posted as.");
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    const text = articleText();
    const hasImg = !!aeRef.current?.querySelector("img");
    if (status === "published" && !text && !hasImg) {
      setAeErr("Write the article before publishing, or save it as a draft.");
      return;
    }
    setAeErr("");
    const ex = excerpt.trim() || seoTwo(text).slice(0, 200);
    const data: ArticleDraft = {
      title,
      slug: sl,
      author: auth,
      status,
      excerpt: ex,
      excerptCustom: !exAuto && !!excerpt.trim(),
      img,
      body: aeRef.current ? aeRef.current.innerHTML : body,
      bodySnip: fmtSnip(aeRef.current ? aeRef.current.innerHTML : body),
      seo: { ...seo, slug: slugPath() },
    };
    if (edit && status === "published" && edit.status !== "published") data.date = Date.now();
    onSubmit(data, edit);
  };

  return (
    <>
      <dialog className="modal modal-product" id="dlg-article" ref={ref} aria-labelledby="ar-title" aria-describedby="ar-sub" onClose={handleClose} onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}>
        <form onSubmit={submit} noValidate>
          <div className="pf-head">
            <div>
              <h2 id="ar-title">{edit ? "Edit Article" : "Add New Article"}</h2>
              <p id="ar-sub">{edit ? "Update this article’s content and details." : "Write a blog post, farm update or resource guide."}</p>
            </div>
            <button type="button" className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
              {icon("i-close", 18, 18, "0 0 16 16")}
            </button>
          </div>
          <label className={`pf-drop${img ? " has-img" : ""}`} id="ar-drop">
            <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload cover image" onChange={(e) => { takeImg(e.target.files?.[0]); e.target.value = ""; }} />
            {img ? <img src={img} alt="Cover image preview" /> : <>{I_CLOUD}<strong>Upload featured banner image</strong><small>Drag and drop an image, or click to browse</small><small>1200 × 630px · JPG, PNG or WebP (max 5MB)</small></>}
          </label>
          <div className="pf-imgbar" hidden={!img}>
            <button type="button" className="btn-text" onClick={() => (document.getElementById("ar-file-btn") as HTMLInputElement | null)?.click()}>Replace image</button>
            <button type="button" className="btn-text" onClick={() => setImg(null)}>Remove</button>
          </div>
          <p className="pf-err" role="alert" hidden={!imgErr} style={{ textAlign: "center" }}>{imgErr}</p>
          <div className="pf-fields pf-grid">
            <div className="pf-field full">
              <label htmlFor="ar-name">Article Title<span className="req" aria-hidden="true">*</span></label>
              <input
                ref={nameRef}
                className="pf-input"
                id="ar-name"
                maxLength={100}
                autoComplete="off"
                placeholder="e.g. 5 Tips for Raising Healthy Broilers"
                value={name}
                onChange={(e) => {
                  clearErr("ar-name");
                  const v = e.target.value;
                  setName(v);
                  if (!slugEdited) {
                    setSlug(slugify(v).slice(0, 80));
                    clearErr("ar-slug");
                  }
                }}
              />
              <p className="pf-err" hidden={!errs["ar-name"]}>{errs["ar-name"]}</p>
            </div>
            <div className="pf-field full">
              <label htmlFor="ar-slug">URL Slug <span className="opt-note">(Auto-generated)</span><span className="req" aria-hidden="true">*</span></label>
              <div className="pf-box ar-slug">
                <span aria-hidden="true">/blog/</span>
                <input
                  id="ar-slug"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={80}
                  placeholder="5-tips-raising-broilers"
                  value={slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    clearErr("ar-slug");
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-"));
                  }}
                />
              </div>
              <p className="pf-err" hidden={!errs["ar-slug"]}>{errs["ar-slug"]}</p>
            </div>
            <div className="pf-field">
              <label htmlFor="ar-author">Author<span className="req" aria-hidden="true">*</span></label>
              <select className="pf-input" id="ar-author" value={author} onChange={(e) => { setAuthor(e.target.value); clearErr("ar-author"); }}>
                {AUTHOR_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <p className="pf-err" hidden={!errs["ar-author"]}>{errs["ar-author"]}</p>
            </div>
            <div className="pf-field">
              <label htmlFor="ar-status">Status</label>
              <select className="pf-input" id="ar-status" value={status} onChange={(e) => setStatus(e.target.value as "published" | "draft")}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="pf-field full">
              <span className="ae-lbl" id="ae-lbl">Content Body<span className="req" aria-hidden="true">*</span></span>
              <div className={`ab-card${aeErr ? " bad" : ""}${!aeText && !img ? " empty" : ""}`} id="ab-card">
                <span className="ps-badge" aria-hidden="true">{I_DOC_16}</span>
                <span className="ab-txt">
                  <b id="ab-sum">{abSum(aeText, body)}</b>
                  <span className="ab-snip" id="ab-snip">
                    {aeText ? (
                      <span dangerouslySetInnerHTML={{ __html: fmtSnip(body) }} />
                    ) : (
                      "Write the article: paragraph text, headings, bullet points."
                    )}
                  </span>
                </span>
                <button type="button" className="ps-edit" id="ab-open" aria-haspopup="dialog" onClick={() => { setBodyOpen(true); }}>
                  {I_PENCIL_12}
                  <span>{aeText ? "Edit content" : "Write content"}</span>
                </button>
              </div>
              <p className="pf-err" hidden={!aeErr}>{aeErr}</p>
            </div>
            <div className="pf-seo full">
              <div className="ps-head">
                <span className="ps-badge" aria-hidden="true">{icon("i-search", 16, 16, "0 0 16 16")}</span>
                <span className="ps-label">Search engine listing<small>How this article appears on Google and when shared</small></span>
                <button type="button" className="ps-edit" onClick={() => { setSeoOpen(true); }}>
                  {I_PENCIL_12}
                  Edit SEO
                </button>
              </div>
              <ArticleSeoCard site={site} title={seo.title || name} meta={seo.meta || excerpt} slugPath={seo.slug || slugPath()} index={seo.index} />
            </div>
          </div>
          <div className="pf-foot">
            <button type="button" className="btn-outline pf-btn" onClick={() => ref.current?.close()}>Cancel</button>
            <button type="submit" className="btn-primary pf-btn">{edit ? "Save Changes" : "Add Article"}</button>
          </div>
        </form>
      </dialog>

      <ArticleBodyDialog
        open={bodyOpen}
        body={body}
        excerpt={excerpt}
        exAuto={exAuto}
        onClose={(saved, nextBody, nextExcerpt, nextAuto) => {
          setBodyOpen(false);
          if (saved) {
            setBody(nextBody);
            setExcerpt(nextExcerpt);
            setExAuto(nextAuto);
            const t = textOf(nextBody);
            setAeText(t);
            setAeErr("");
            fillSeo(t, nextExcerpt);
          }
        }}
      />

      <ArticleSeoDialog
        open={seoOpen}
        site={site}
        name={name}
        seo={seo}
        img={img}
        onClose={(saved, next) => {
          setSeoOpen(false);
          if (saved && next) {
            setSeo(next);
            const sl = next.slug.trim().replace(/^\/?(blog\/)?/, "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
            if (sl && sl !== slug) {
              setSlug(sl);
              setSlugEdited(true);
              clearErr("ar-slug");
            }
          }
        }}
      />
    </>
  );
}

function abSum(text: string, html: string) {
  const n = text ? text.split(" ").length : 0;
  const hasImg = typeof document !== "undefined" && /<img/i.test(html);
  if (n) return `${n} ${n === 1 ? "word" : "words"} · ${Math.max(1, Math.round(n / 200))} min read`;
  return hasImg ? "Images only" : "No content yet";
}

/* ---------------------------------------------------------- content body */

function ArticleBodyDialog({
  open,
  body,
  excerpt,
  exAuto,
  onClose,
}: {
  open: boolean;
  body: string;
  excerpt: string;
  exAuto: boolean;
  onClose: (saved: boolean, body: string, excerpt: string, exAuto: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<Range | null>(null);
  const snapRef = useRef<{ body: string; excerpt: string; exAuto: boolean } | null>(null);
  const savedRef = useRef(false);
  const linkRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);

  const [words, setWords] = useState(0);
  const [ex, setEx] = useState(excerpt);
  const [auto, setAuto] = useState(exAuto);
  const [block, setBlock] = useState("p");
  const [fmt, setFmt] = useState<Record<string, boolean>>({});
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!open) return;
    if (!d.open) d.showModal();
    snapRef.current = { body, excerpt, exAuto };
    savedRef.current = false;
    if (docRef.current) {
      docRef.current.innerHTML = body;
      setWords(countWords(docRef.current.innerText));
    }
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
      document.execCommand("styleWithCSS", false, "false");
    } catch {
      /* older browsers */
    }
    requestAnimationFrame(() => {
      docRef.current?.focus();
      const r = document.createRange();
      const el = docRef.current;
      if (el) {
        r.selectNodeContents(el);
        r.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
      }
    });
    return () => {
      if (d.open) closingRef.current = true;
      d.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    const snap = snapRef.current;
    const el = docRef.current;
    const nextBody = savedRef.current && el ? el.innerHTML : snap ? snap.body : body;
    const nextEx = savedRef.current ? ex : snap ? snap.excerpt : excerpt;
    const nextAuto = savedRef.current ? auto : snap ? snap.exAuto : exAuto;
    onClose(savedRef.current, nextBody, nextEx, nextAuto);
  };

  const aeTextNow = () => (docRef.current ? (docRef.current.innerText || "").replace(/\s+/g, " ").trim() : "");
  const countWords = (t: string) => (t ? t.split(" ").length : 0);

  const saveRange = () => {
    const sel = window.getSelection();
    const el = docRef.current;
    if (sel && sel.rangeCount && el && el.contains(sel.anchorNode)) rangeRef.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreRange = () => {
    const el = docRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    el.focus();
    const r = rangeRef.current;
    if (r && el.contains(r.startContainer) && el.contains(r.endContainer)) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onSel = () => {
      const el = docRef.current;
      const sel = window.getSelection();
      if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode)) return;
      saveRange();
      let blk = "";
      try {
        blk = String(document.queryCommandValue("formatBlock")).toLowerCase();
      } catch {
        blk = "";
      }
      const q = (c: string) => {
        try {
          return document.queryCommandState(c);
        } catch {
          return false;
        }
      };
      setBlock(["h2", "h3"].includes(blk) ? blk : "p");
      setFmt({
        bold: q("bold"),
        italic: q("italic"),
        underline: q("underline"),
        insertUnorderedList: q("insertUnorderedList"),
        insertOrderedList: q("insertOrderedList"),
        quote: blk === "blockquote",
      });
      setTick((t) => t + 1);
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [open]);

  const refresh = () => {
    setWords(countWords(aeTextNow()));
    saveRange();
  };

  const cmd = (c: string) => {
    restoreRange();
    const el = docRef.current;
    if (!el) return;
    if (c === "quote") {
      let blk = "";
      try {
        blk = String(document.queryCommandValue("formatBlock")).toLowerCase();
      } catch {
        blk = "";
      }
      document.execCommand("formatBlock", false, blk === "blockquote" ? "p" : "blockquote");
    } else if (c === "removeFormat") {
      document.execCommand("removeFormat");
      document.execCommand("formatBlock", false, "p");
    } else {
      document.execCommand(c);
    }
    saveRange();
    refresh();
    setTick((t) => t + 1);
  };

  const applyLink = () => {
    let u = url.trim();
    setLinkOpen(false);
    restoreRange();
    if (!u) {
      setUrl("");
      return;
    }
    if (!/^(https?:|mailto:|\/)/i.test(u)) u = "https://" + u;
    const sel = window.getSelection();
    if (sel && sel.isCollapsed) document.execCommand("insertHTML", false, `<a href="${u.replace(/"/g, "&quot;")}">${u.replace(/</g, "&lt;")}</a>`);
    else document.execCommand("createLink", false, u);
    setUrl("");
    refresh();
  };

  const readImg = (f?: File) => {
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type) || f.size > 5 * 1024 * 1024) {
      showToastSafe("Use a JPG, PNG or WebP image under 5MB.");
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      restoreRange();
      document.execCommand("insertHTML", false, `<img src="${String(r.result)}" alt="">`);
      refresh();
    };
    r.readAsDataURL(f);
  };

  const n = words;
  return (
    <dialog className="modal modal-seo modal-abody" ref={ref} aria-labelledby="ab-title" onClose={handleClose} onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }} hidden={!open}>
      <div className="seo-head">
        <div>
          <h2 id="ab-title">Content Body</h2>
          <p>Write the article. Use the toolbar for headings, bold text and bullet points.</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={() => { savedRef.current = false; ref.current?.close(); }}>
          {icon("i-close", 18, 18, "0 0 16 16")}
        </button>
      </div>
      <div className="seo-body">
        <div className="ae" id="ae">
          <div className="ae-bar" role="toolbar" aria-label="Formatting" aria-controls="ae-doc">
            <label className="sr-only" htmlFor="ae-block">Text style</label>
            <select
              className="ae-block"
              id="ae-block"
              value={block}
              onChange={(e) => {
                restoreRange();
                document.execCommand("formatBlock", false, e.target.value);
                setBlock(e.target.value);
                refresh();
              }}
            >
              <option value="p">Paragraph</option>
              <option value="h2">Heading</option>
              <option value="h3">Subheading</option>
            </select>
            <span className="ae-sep" aria-hidden="true" />
            <AeBtn label="Bold" title="Bold (Ctrl+B): highlight text, or click before typing" on={!!fmt.bold} onClick={() => cmd("bold")}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 3h4.2a2.6 2.6 0 0 1 0 5.2H4.5zM4.5 8.2h4.8a2.6 2.6 0 0 1 0 5.3H4.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            </AeBtn>
            <AeBtn label="Italic" title="Italic (Ctrl+I): highlight text, or click before typing" on={!!fmt.italic} onClick={() => cmd("italic")}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3H6.5M9.5 13H6M9 3 7 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </AeBtn>
            <AeBtn label="Underline" title="Underline (Ctrl+U): highlight text, or click before typing" on={!!fmt.underline} onClick={() => cmd("underline")}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 2.5v5a3.5 3.5 0 0 0 7 0v-5M3.5 14h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </AeBtn>
            <span className="ae-sep" aria-hidden="true" />
            <AeBtn label="Bullet list" title="Bullet list" on={!!fmt.insertUnorderedList} onClick={() => cmd("insertUnorderedList")}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="3" cy="4" r="1" fill="currentColor" /><circle cx="3" cy="8" r="1" fill="currentColor" /><circle cx="3" cy="12" r="1" fill="currentColor" /><path d="M6 4h7.5M6 8h7.5M6 12h7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </AeBtn>
            <AeBtn label="Numbered list" title="Numbered list" on={!!fmt.insertOrderedList} onClick={() => cmd("insertOrderedList")}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.4 3.2 3.4 2.6V6M2.3 13.4h2l-1.9-2.2c.6-.8 1.9-.6 1.9.3M6.5 4h7M6.5 8h7M6.5 12h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </AeBtn>
            <span className="ae-sep" aria-hidden="true" />
            <AeBtn label="Quote" title="Quote" on={!!fmt.quote} onClick={() => cmd("quote")}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 4.5h3.5v3.5c0 2-1 3.2-3 3.8M9 4.5h3.5v3.5c0 2-1 3.2-3 3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </AeBtn>
            <AeBtn label="Link" title="Link" on={linkOpen} onClick={() => { restoreRange(); setLinkOpen((v) => !v); }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6.5 9.5 9.5 6.5M5.5 10.5l-1 1a2.5 2.5 0 0 1-3.5-3.5l2-2M10.5 5.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </AeBtn>
            <AeBtn label="Image" title="Insert image" on={false} onClick={() => imgRef.current?.click()}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><circle cx="5.5" cy="6.5" r="1" fill="currentColor" /><path d="m3.5 11 3-3 2.5 2.5 1.5-1.5 2 2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
            </AeBtn>
            <AeBtn label="Clear formatting" title="Clear formatting" on={false} onClick={() => cmd("removeFormat")}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 3h8M8 3v9M5.5 13h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
            </AeBtn>
          </div>
          <div className="ae-link" ref={linkRef} hidden={!linkOpen}>
            <label className="sr-only" htmlFor="ae-url">Link address</label>
            <input id="ae-url" ref={urlRef} type="url" inputMode="url" autoComplete="off" placeholder="Paste a link, e.g. https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") { e.preventDefault(); setLinkOpen(false); } }} />
            <button type="button" className="btn-dark" onClick={applyLink}>Apply</button>
            <button type="button" className="btn-text" onClick={() => setLinkOpen(false)}>Cancel</button>
          </div>
          <div
            className={`ae-doc${n === 0 ? " empty" : ""}`}
            id="ae-doc"
            ref={docRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-labelledby="ab-title"
            data-ph="Start writing… paragraph text, headings, bullet points."
            suppressContentEditableWarning
            onInput={refresh}
            onKeyUp={saveRange}
            onMouseUp={saveRange}
            onPaste={(e) => {
              e.preventDefault();
              const cd = e.clipboardData || (window as unknown as { clipboardData: DataTransfer }).clipboardData;
              document.execCommand("insertText", false, cd.getData("text/plain"));
            }}
            onKeyDown={(e) => {
              if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
              const k = e.key.toLowerCase();
              const map: Record<string, string> = { b: "bold", i: "italic", u: "underline" };
              if (map[k]) {
                e.preventDefault();
                cmd(map[k]);
              }
            }}
          />
          <div className="ae-foot">
            <span className="ae-tip">Tip: highlight text, then click <b>B</b>, <i>I</i> or <u>U</u>. Or click one first and start typing.</span>
            <span id="ae-words">{n} {n === 1 ? "word" : "words"}{n ? ` · ${Math.max(1, Math.round(n / 200))} min read` : ""}</span>
          </div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            ref={imgRef}
            onChange={(e) => {
              readImg(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <div className="pf-field ab-ex">
          <div className="seo-lr">
            <label htmlFor="ar-excerpt">Excerpt <span className="opt-note" id="ar-ex-mode">{auto ? "(Auto-generated from the article)" : "(Written by you)"}</span></label>
            <button type="button" className="btn-text" hidden={!auto} style={{ fontSize: 12 }} onClick={() => { setEx(seoTwo(aeTextNow()).slice(0, 200)); setAuto(true); }}>
              Use article opening
            </button>
          </div>
          <textarea
            className="pf-input"
            id="ar-excerpt"
            maxLength={200}
            placeholder="Fills in automatically as you write. You can also write your own short summary."
            value={ex}
            onChange={(e) => { setAuto(false); setEx(e.target.value); }}
            onBlur={(e) => { if (!e.target.value.trim()) { setEx(seoTwo(aeTextNow()).slice(0, 200)); setAuto(true); } }}
          />
          <div className="seo-lr" style={{ marginTop: 4 }}>
            <span className="px-help" style={{ margin: 0 }}>Shown in search results and when the article is shared.</span>
            <span className="pf-count" aria-live="polite" style={{ margin: 0 }}>{ex.length}/200</span>
          </div>
        </div>
      </div>
      <div className="seo-foot">
        <span />
        <span className="seo-actions">
          <button type="button" className="btn-outline pf-btn" onClick={() => { savedRef.current = false; ref.current?.close(); }}>Cancel</button>
          <button type="button" className="btn-primary pf-btn" onClick={() => { savedRef.current = true; ref.current?.close(); }}>Done</button>
        </span>
      </div>
    </dialog>
  );
}

function AeBtn({ label, title, on, onClick, children }: { label: string; title: string; on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="ae-tb" aria-label={label} title={title} aria-pressed={on} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
}

function showToastSafe(text: string) {
  /* Body-dialog image errors mirror the prototype's toast; the nearest
     screen-level toast isn't reachable from here, so the alert role p is
     unused and the message lands in a console-safe no-op fallback. */
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("dr-toast", { detail: text }));
}

/* ---------------------------------------------------------- article SEO */

function ArticleSeoCard({ site, title, meta, slugPath, index }: { site: { name: string }; title: string; meta: string; slugPath: string; index: boolean }) {
  const domain = (site as { domain?: string }).domain || "";
  const path = (slugPath || "").replace(/^\/+/, "").split("/").filter(Boolean).join(" › ");
  const url = domain + (path ? " › " + path : "");
  const ini = (site.name || "?").charAt(0).toUpperCase();
  return (
    <div className="ps-card">
      <div className="ps-top">
        <span className="gp-fav" id="arps-fav">{ini}</span>
        <span className="ps-site">
          <b id="arps-site">{site.name}</b>
          <span id="arps-url">{url}</span>
        </span>
        <span className={`ps-pill${index ? "" : " off"}`} id="arps-pill">{index ? "Visible on Google" : "Hidden from Google"}</span>
      </div>
      <div className="ps-t" id="arps-t">{seoCut(title, SEO_T) || "Article title"}</div>
      <div className="ps-d" id="arps-d">{seoCut(meta, SEO_D) || "Add a description and it shows here."}</div>
    </div>
  );
}

function ArticleSeoDialog({
  open,
  site,
  name,
  seo,
  img,
  onClose,
}: {
  open: boolean;
  site: { name: string; domain?: string };
  name: string;
  seo: ArticleSeo;
  img: string | null;
  onClose: (saved: boolean, next: ArticleSeo | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);
  const snapRef = useRef<ArticleSeo>(seo);
  const savedRef = useRef(false);
  const ogFileRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<ArticleSeo>(seo);
  const [og, setOg] = useState<string | null>(seo.og ?? null);
  const [slugOpen, setSlugOpen] = useState(false);
  const [ogOpen, setOgOpen] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d || !open) return;
    if (!d.open) d.showModal();
    snapRef.current = seo;
    setDraft(seo);
    setOg(seo.og ?? null);
    setSlugOpen(false);
    setOgOpen(false);
    savedRef.current = false;
    return () => {
      if (d.open) closingRef.current = true;
      d.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    if (savedRef.current) onClose(true, { ...draft, og });
    else onClose(false, null);
  };

  const domain = site.domain || "";
  const slugPathVal = draft.slug || "/blog/";
  const path = slugPathVal.replace(/^\/+/, "").split("/").filter(Boolean).join(" › ");
  const url = domain + (path ? " › " + path : "");
  const T = seoCut(draft.title, SEO_T) || "Article title";
  const D = seoCut(draft.meta, SEO_D) || "Add a description and it shows here.";
  const ini = (site.name || "?").charAt(0).toUpperCase();
  const useImg = draft.ogUse !== false;
  const ogImg = useImg ? img : og;

  const readOg = (f?: File) => {
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type) || f.size > 5 * 1024 * 1024) {
      showToastSafe("Use a JPG, PNG or WebP image under 5MB.");
      return;
    }
    const r = new FileReader();
    r.onload = () => setOg(String(r.result));
    r.readAsDataURL(f);
  };

  return (
    <dialog className="modal modal-seo" ref={ref} aria-labelledby="aseo-title" onClose={handleClose} onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }} hidden={!open}>
      <div className="seo-head">
        <div>
          <h2 id="aseo-title">Search engine listing</h2>
          <p>Control how this article looks on Google and when people share it.</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={() => { savedRef.current = false; ref.current?.close(); }}>
          {icon("i-close", 18, 18, "0 0 16 16")}
        </button>
      </div>
      <div className="seo-body">
        <div className="seo-stage" aria-label="Google preview">
          <div className="seo-q">{icon("i-search", 14, 14, "0 0 16 16")}<span>{name.trim().toLowerCase() || "your article"}</span></div>
          <div className={`seo-res${draft.index ? "" : " off"}`}>
            <div className="ps-top">
              <span className="gp-fav">{ini}</span>
              <span className="ps-site"><b>{site.name}</b><span>{url}</span></span>
            </div>
            <div className="seo-rt">{T}</div>
            <div className="seo-rd">{D}</div>
          </div>
          <p className="seo-note" hidden={draft.index}>This page is hidden from Google. People with the link can still open it.</p>
        </div>
        <div className="seo-fields">
          <div className="pf-field">
            <div className="seo-lr">
              <label htmlFor="ar-seo-title">Meta title</label>
              <span className={draft.title.length > SEO_T ? "over" : ""}>{draft.title.length} / {SEO_T}</span>
            </div>
            <input
              className="pf-input"
              id="ar-seo-title"
              autoComplete="off"
              placeholder="5 Essential Tips for Healthy Broiler Farming"
              value={draft.title}
              onChange={(e) => setDraft((s) => ({ ...s, title: e.target.value, auto: { ...s.auto, title: false } }))}
            />
            <div className="seo-meter"><i className={draft.title.length > SEO_T ? "over" : ""} style={{ width: `${Math.min(100, (draft.title.length / SEO_T) * 100)}%` }} /></div>
          </div>
          <div className="pf-field">
            <div className="seo-lr">
              <label htmlFor="ar-seo-meta">Meta description</label>
              <span className={draft.meta.length > SEO_D ? "over" : ""}>{draft.meta.length} / {SEO_D}</span>
            </div>
            <textarea
              className="pf-input"
              id="ar-seo-meta"
              placeholder="Learn practical biosecurity, feed scheduling, and natural gut hygiene methods for broilers."
              value={draft.meta}
              onChange={(e) => setDraft((s) => ({ ...s, meta: e.target.value, auto: { ...s.auto, meta: false } }))}
            />
            <div className="seo-meter"><i className={draft.meta.length > SEO_D ? "over" : ""} style={{ width: `${Math.min(100, (draft.meta.length / SEO_D) * 100)}%` }} /></div>
          </div>
          <div className="sx-list">
            <div className="sx">
              <button type="button" className="sx-row" aria-expanded={slugOpen} aria-controls="ar-sx-slug" onClick={() => setSlugOpen((v) => !v)}>
                <span className="sx-k">URL slug</span>
                <span className="sx-v">{domain + (slugPathVal ? "/" + slugPathVal.replace(/^\/+/, "") : "")}</span>
                <span className="sx-act">{slugOpen ? "Done" : "Edit"}</span>
              </button>
              <div className="sx-body" id="ar-sx-slug" hidden={!slugOpen}>
                <label className="sr-only" htmlFor="ar-seo-slug">URL slug</label>
                <div className="pf-box">
                  <span className="seo-dom">{domain}</span>
                  <input id="ar-seo-slug" autoComplete="off" spellCheck={false} placeholder="/blog/5-tips-raising-broilers" value={draft.slug} onChange={(e) => setDraft((s) => ({ ...s, slug: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="sx">
              <button type="button" className="sx-row" aria-expanded={ogOpen} aria-controls="ar-sx-og" onClick={() => setOgOpen((v) => !v)}>
                <span className="sx-k">Social share image</span>
                <span className="sx-v">
                  <span className="sx-thumb">{ogImg ? <img src={ogImg} alt="" /> : null}</span>
                  {useImg ? (img ? "Featured banner image" : "Featured banner image (none added yet)") : og ? "Custom image" : "No image yet"}
                </span>
                <span className="sx-act">{ogOpen ? "Done" : "Change"}</span>
              </button>
              <div className="sx-body" id="ar-sx-og" hidden={!ogOpen}>
                <label className="ar-og-chk">
                  <input type="checkbox" checked={useImg} onChange={(e) => setDraft((s) => ({ ...s, ogUse: e.target.checked }))} />
                  {" "}Use featured banner image for WhatsApp/Social
                </label>
                <div className="ar-og-own" hidden={useImg}>
                  <button type="button" className="ps-edit" onClick={() => ogFileRef.current?.click()}>Upload a different image</button>
                  <button type="button" className="btn-text" hidden={!og} onClick={() => setOg(null)}>Remove</button>
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden ref={ogFileRef} onChange={(e) => { readOg(e.target.files?.[0]); e.target.value = ""; }} />
                </div>
                <div className="ar-og" aria-label="Social share preview">
                  <div className="ar-og-img">{ogImg ? <img src={ogImg} alt="" /> : <span>{useImg ? "Add a featured banner image to the article" : "Upload an image for social sharing"}</span>}</div>
                  <div className="ar-og-txt">
                    <small>{domain.toUpperCase()}</small>
                    <b>{T}</b>
                    <span>{D}</span>
                  </div>
                </div>
              </div>
            </div>
            <label className="sx-row seo-switch" title="Hidden pages still work for people who have the link.">
              <span className="sx-k">Show on search engines</span>
              <span className="sx-v">{draft.index ? "Visible on Google" : "Hidden from Google"}</span>
              <input type="checkbox" role="switch" checked={draft.index} onChange={(e) => setDraft((s) => ({ ...s, index: e.target.checked }))} />
            </label>
          </div>
        </div>
      </div>
      <div className="seo-foot">
        <button
          type="button"
          className="btn-text"
          onClick={() => {
            setDraft((s) => ({ ...s, auto: { title: true, meta: true }, ogUse: true }));
            setOg(null);
          }}
        >
          Reset to auto-generated
        </button>
        <span className="seo-actions">
          <button type="button" className="btn-outline pf-btn" onClick={() => { savedRef.current = false; ref.current?.close(); }}>Cancel</button>
          <button type="button" className="btn-primary pf-btn" onClick={() => { savedRef.current = true; ref.current?.close(); }}>Save changes</button>
        </span>
      </div>
    </dialog>
  );
}

/* =================================================================
   E-Commerce / Store -> E-Commerce / Store (Orders) and the Order Details
   dialog, from renderOrdersView() / paintOrders() / paintOrderBody() and
   openOrder() in digital-romanian-screen.html.
   ================================================================= */

export type OrderStatus = "pending" | "processing" | "out" | "delivered" | "cancelled";
export type OrderPayment = "paid" | "failed" | "pending";

export type OrderItem = {
  name: string;
  sub: string;
  price: number;
  qty: number;
  cat: string;
  photo?: string;
  img: string | null;
};

export type Order = {
  id: string;
  name: string;
  email: string;
  pay: OrderPayment;
  fulfil: OrderStatus;
  items: OrderItem[];
  phone: string;
  addr: string;
  note: string;
  color: string;
};

export const FULFIL: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  out: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const PAY: Record<OrderPayment, string> = { paid: "Paid", failed: "Failed", pending: "Pending" };
const AV_COLORS = ["#1d2a6b", "#a0700f", "#8a3a2c", "#2f5d8a", "#1e5a46", "#5a2d82", "#1c1c1a", "#8b1d3d"];
const ORDER_STATUS_CYCLE: OrderStatus[] = ["delivered", "delivered", "processing", "out", "delivered", "pending", "cancelled", "delivered"];

/* First eight orders mirror the Figma table; [product index, qty] point at the
   store's first eight products. */
const ORDER_SEED: [string, string, OrderPayment, OrderStatus, [number, number][]][] = [
  ["Adebayo Ade", "adebayo@gmail.com", "paid", "processing", [[0, 1], [1, 1]]],
  ["Chidi Okafor", "chidi@gmail.com", "paid", "delivered", [[2, 1]]],
  ["Fatima Bello", "fatima@yahoo.com", "failed", "cancelled", [[3, 2], [5, 1], [6, 2]]],
  ["Daniel Okafor", "daniel@gmail.com", "paid", "out", [[7, 2], [1, 1]]],
  ["Grace Samuel", "grace@gmail.com", "paid", "processing", [[5, 1]]],
  ["Ibrahim Yusuf", "ibrahim@gmail.com", "paid", "delivered", [[0, 1], [6, 1]]],
  ["Blessing Eze", "blessing@gmail.com", "pending", "pending", [[2, 1], [3, 1], [7, 2]]],
  ["Tunde Adebayo", "tunde@gmail.com", "paid", "out", [[4, 1]]],
];
const MORE_CUSTOMERS: [string, string][] = [
  ["Ngozi Umeh", "ngozi.umeh@gmail.com"],
  ["Emeka Obi", "emeka.obi@yahoo.com"],
  ["Aisha Musa", "aisha.musa@gmail.com"],
  ["Kunle Ajayi", "kunle.ajayi@gmail.com"],
  ["Funmi Adeyemi", "funmi.adeyemi@gmail.com"],
  ["Segun Bakare", "segun.bakare@gmail.com"],
  ["Zainab Lawal", "zainab.lawal@gmail.com"],
  ["Tobi Oladipo", "tobi.oladipo@gmail.com"],
  ["Halima Sani", "halima.sani@gmail.com"],
  ["Uche Nwosu", "uche.nwosu@gmail.com"],
];
const ADDRS = [
  "12, Freedom St, Lagos, Nigeria",
  "4 Awolowo Rd, Ikoyi, Lagos",
  "22 Ring Rd, Ibadan, Oyo",
  "8 Aminu Kano Cres, Wuse 2, Abuja",
  "15 Trans-Amadi Rd, Port Harcourt",
];
const NOTES = ["Leave at the gate. Call on arrival.", "Deliver after 5pm, please.", "", "Ring the bell twice.", ""];

/* ordersOf(s) - 67 deterministic demo orders built from the catalogue. */
export function generateOrders(site: SiteLite): Order[] {
  const prods = generateProducts(site);
  const orders: Order[] = [];
  if (!prods.length) return orders;
  for (let i = 0; i < 67; i++) {
    let name: string;
    let email: string;
    let pay: OrderPayment;
    let fulfil: OrderStatus;
    let picks: [number, number][];
    if (ORDER_SEED[i]) {
      [name, email, pay, fulfil, picks] = ORDER_SEED[i];
    } else {
      [name, email] = MORE_CUSTOMERS[i % MORE_CUSTOMERS.length];
      fulfil = ORDER_STATUS_CYCLE[i % 8];
      pay = fulfil === "cancelled" ? "failed" : fulfil === "pending" ? "pending" : "paid";
      picks = Array.from({ length: 1 + (i % 3) }, (_, k) => [(i * 3 + k * 5) % prods.length, 1 + ((i + k) % 2)] as [number, number]);
    }
    const items: OrderItem[] = picks.map(([pi, qty]) => {
      const p = prods[pi % prods.length];
      return { name: p.name, sub: p.sub, price: p.price, qty, cat: p.cat, photo: p.photo, img: p.img };
    });
    orders.push({
      id: "ORD-" + (1089 - i),
      name,
      email,
      pay,
      fulfil,
      items,
      phone: i === 0 ? "+234 812 345 6789" : `+234 ${803 + ((i * 7) % 17)} ${100 + ((i * 37) % 900)} ${1000 + ((i * 613) % 9000)}`,
      addr: ADDRS[i % ADDRS.length],
      note: NOTES[i % NOTES.length],
      color: AV_COLORS[i % AV_COLORS.length],
    });
  }
  return orders;
}

const initials = (s: string) =>
  (s || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const itemCount = (o: Order) => o.items.reduce((a, it) => a + it.qty, 0);
function orderTotals(o: Order) {
  const sub = Math.round(o.items.reduce((a, it) => a + it.price * it.qty, 0) * 100) / 100;
  const ship = 1;
  const tax = Math.round(sub * 0.075 * 100) / 100;
  return { sub, ship, tax, total: Math.round((sub + ship + tax) * 100) / 100 };
}

const CHEV_D = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <use href="#i-chevron-down" />
  </svg>
);
const I_PHONE_S = icon("i-phone", 12, 12, "0 0 20 20");
const I_PIN = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 14.25s-4.5-4-4.5-7.5a4.5 4.5 0 0 1 9 0c0 3.5-4.5 7.5-4.5 7.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="8" cy="6.75" r="1.6" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);
const I_NOTE = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const OD_CHEV = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: "#fff" }}>
    <path d="M2.67 6 8 11.33 13.33 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type OrderFilter = "all" | OrderStatus;

export function OrdersView({
  site,
  orders,
  setOrders,
  showToast,
}: {
  site: SiteLite & { name: string };
  orders: Order[];
  setOrders: (updater: (list: Order[]) => Order[]) => void;
  showToast: (text: string) => void;
}) {
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [page, setPage] = useState(1);
  const [dialogId, setDialogId] = useState<string | null>(null);

  const list = orders.filter((o) => filter === "all" || o.fulfil === filter);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(Math.max(1, page), pages);
  const start = (cur - 1) * PER_PAGE;
  const rows = list.slice(start, start + PER_PAGE);

  const activeOrder = dialogId ? orders.find((o) => o.id === dialogId) ?? null : null;

  const filterLabel = filter === "all" ? "All Statuses" : FULFIL[filter];
  const filterItems: MenuItem[] = [
    { kind: "heading", label: "Fulfillment" },
    ...([["all", "All Statuses"], ...Object.entries(FULFIL)] as [OrderFilter, string][]).map(([k, label]) => ({
      kind: "item" as const,
      label,
      checked: k === filter,
      onSelect: () => {
        setFilter(k);
        setPage(1);
      },
    })),
  ];

  const exportOrders = () => {
    if (!list.length) {
      showToast("No orders to export");
      return;
    }
    const header = ["Order ID", "Customer", "Email", "Phone", "Address", "Items", "Subtotal", "Shipping", "Tax", "Total", "Payment", "Fulfillment"];
    const data: (string | number)[][] = [
      header,
      ...list.map((o) => {
        const t = orderTotals(o);
        return ["#" + o.id, o.name, o.email, o.phone, o.addr, itemCount(o), t.sub.toFixed(2), t.ship.toFixed(2), t.tax.toFixed(2), t.total.toFixed(2), PAY[o.pay], FULFIL[o.fulfil]];
      }),
    ];
    const csv = data.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${slugify(site.name) || "site"}-orders.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast(`Exported ${list.length} ${list.length === 1 ? "order" : "orders"}`);
  };

  const updateStatus = (o: Order, k: OrderStatus) => {
    if (k === o.fulfil) return;
    setOrders((all) =>
      all.map((x) => (x.id === o.id ? { ...x, fulfil: k, pay: k === "cancelled" && x.pay === "pending" ? "failed" : x.pay } : x)),
    );
    showToast(`#${o.id} marked as ${FULFIL[k]}`);
  };

  return (
    <>
      <div className="ov-head">
        <h1 tabIndex={-1} className="sv-title">
          E-Commerce / Store <span className="engine" title="Store engine connected">{I_CHECK_C}Medusa</span>
        </h1>
        <p>Manage your products, inventory, order lists, and payment channel toggles.</p>
      </div>

      <section className="ov-card pcard" aria-labelledby="oc-t">
        <header className="pcard-head">
          <div>
            <h2 id="oc-t">Orders Management</h2>
            <p>Track customer purchases, update delivery statuses, and verify payments in real-time.</p>
          </div>
          <div className="ocard-tools">
            <div className="ofilter">
              <MoreMenu
                ariaLabel="Filter orders"
                buttonClassName="ofilter-btn"
                className="fmenu"
                buttonContent={<>Filter: <b>{filterLabel}</b>{CHEV_D}</>}
                items={filterItems}
              />
            </div>
            <button type="button" className="btn-dark btn-export" onClick={exportOrders}>Export CSV</button>
          </div>
        </header>

        <div className="otab" role="table" aria-label="Orders">
          <div className="otab-row head" role="row">
            <span role="columnheader">Order ID</span>
            <span role="columnheader">Customers</span>
            <span role="columnheader">Items</span>
            <span role="columnheader">Total</span>
            <span role="columnheader">Payment</span>
            <span role="columnheader">Fulfillment</span>
            <span role="columnheader">Actions</span>
          </div>
          <div id="ord-rows" role="rowgroup">
            {rows.map((o) => {
              const t = orderTotals(o);
              const n = itemCount(o);
              const items = `${n} ${n === 1 ? "Item" : "Items"}`;
              return (
                <div className="otab-row" role="row" key={o.id}>
                  <span className="o-id" role="cell">#{o.id}</span>
                  <span className="o-cust" role="cell">
                    <span className="oav" style={{ background: o.color }} aria-hidden="true">{initials(o.name)}</span>
                    <span className="ptxt">
                      <strong>{o.name}</strong>
                      <small>{o.email}</small>
                      <small className="pmeta">#{o.id} · {items} · {money(t.total)} · {PAY[o.pay]}</small>
                    </span>
                  </span>
                  <span className="o-items" role="cell">{items}</span>
                  <span className="o-total" role="cell">{money(t.total)}</span>
                  <span className="o-pay" role="cell"><span className={`pay ${o.pay}`}>{PAY[o.pay]}</span></span>
                  <span className="o-ful" role="cell"><span className={`fpill ${o.fulfil}`}>{FULFIL[o.fulfil]}</span></span>
                  <span className="o-act" role="cell">
                    <button type="button" className="o-view" aria-label={`View order #${o.id}`} onClick={() => setDialogId(o.id)}>View</button>
                  </span>
                </div>
              );
            })}
            {rows.length === 0 ? (
              orders.length ? (
                <div className="tab-empty">
                  <strong>No {filter === "all" ? "" : FULFIL[filter].toLowerCase()} orders</strong>
                  Try another status.
                  <br />
                  <button type="button" className="btn-text" onClick={() => { setFilter("all"); setPage(1); }}>Show all orders</button>
                </div>
              ) : (
                <div className="tab-empty">
                  <strong>No orders yet</strong>
                  Orders show up here as soon as customers check out.
                  <br />
                  <Link className="btn-dark" to="/overview/products">Go to Products</Link>
                </div>
              )
            ) : null}
          </div>
        </div>
      </section>

      <div className="sv-foot" id="ord-foot">
        <span>{list.length ? `Showing ${start + 1}-${start + rows.length} of ${list.length} orders` : "Showing 0 orders"}</span>
        {list.length > PER_PAGE ? (
          <Pager
            current={cur}
            pages={pages}
            label="Order pages"
            onChange={(n) => {
              setPage(n);
              document.querySelector(".pcard")?.scrollIntoView({ block: "nearest" });
            }}
          />
        ) : null}
      </div>

      {activeOrder ? (
        <OrderDialog
          key={activeOrder.id}
          order={activeOrder}
          onUpdate={(k) => updateStatus(activeOrder, k)}
          onCancel={() => setDialogId(null)}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------- order details */

function OrderDialog({ order, onUpdate, onCancel }: { order: Order; onUpdate: (k: OrderStatus) => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  /* Same StrictMode-aware close guard as ProductDialog / PageDialog. */
  const closingRef = useRef(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    return () => {
      if (d.open) closingRef.current = true;
      d.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    onCancel();
  };

  const t = orderTotals(order);
  const n = itemCount(order);
  const statusItems: MenuItem[] = [
    { kind: "heading", label: "Set fulfillment" },
    ...Object.entries(FULFIL).map(([k, label]) => ({
      kind: "item" as const,
      label,
      checked: k === order.fulfil,
      onSelect: () => onUpdate(k as OrderStatus),
    })),
  ];

  return (
    <dialog
      className="modal modal-order"
      ref={ref}
      aria-labelledby="od-title"
      aria-label={`Order details for #${order.id}`}
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <form noValidate onSubmit={(e) => e.preventDefault()}>
        <div className="od-head">
          <h2 id="od-title">Order Details</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
            {icon("i-close", 18, 18, "0 0 16 16")}
          </button>
        </div>

        <div id="od-body">
          <section className="od-sec">
            <h3>Customer Information</h3>
            <div className="od-cust">
              <span className="oav lg" style={{ background: order.color }} aria-hidden="true">{initials(order.name)}</span>
              <div><strong>{order.name}</strong><small>{order.email}</small></div>
            </div>
            <ul className="od-lines">
              <li>{I_PHONE_S}<span>{order.phone}</span></li>
              <li>{I_PIN}<span>{order.addr}</span></li>
              {order.note ? <li>{I_NOTE}<span>{order.note}</span></li> : null}
            </ul>
          </section>

          <section className="od-sec">
            <h3>Order Items ({n})</h3>
            <ul className="od-items">
              {order.items.map((it, i) => (
                <li key={i}>
                  <span className="pthumb" aria-hidden="true">
                    <img src={thumbSrc(it)} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} />
                  </span>
                  <span className="ptxt"><strong>{it.name}</strong><small>{it.sub}</small></span>
                  <span className="od-pr"><strong>{money(it.price * it.qty)}</strong><small>Qty: {it.qty}</small></span>
                </li>
              ))}
            </ul>
          </section>

          <section className="od-sec od-sum">
            <p><span>Subtotal</span><span>{money(t.sub)}</span></p>
            <p><span>Shipping</span><span>{money(t.ship)}</span></p>
            <p><span>Tax (7.5%)</span><span>{money(t.tax)}</span></p>
          </section>

          <p className="od-total"><span>Total</span><strong>{money(t.total)}</strong></p>
          <div className="od-status">
            <span><b>Status:</b><i className={order.fulfil}>{FULFIL[order.fulfil]}</i></span>
          </div>
        </div>

        <div className="od-foot">
          <button type="button" className="btn-outline od-btn" onClick={() => ref.current?.close()}>Cancel</button>
          <div className="od-upd">
            <MoreMenu
              ariaLabel="Update status"
              buttonClassName="btn-primary od-btn"
              className="fmenu od-menu"
              buttonContent={<>Update Status {OD_CHEV}</>}
              items={statusItems}
            />
          </div>
        </div>
      </form>
    </dialog>
  );
}

/* =================================================================
   E-Commerce / Store -> Categories and the Create / edit category
   dialog, from renderCategoriesView() / paintCategories() / openCategory()
   in the responsive prototype. Uses the same row pattern as Products.
   ================================================================= */

export type Category = {
  id: string;
  name: string;
  slug: string;
  desc: string;
  count: number;
  emoji: string;
  tint: string;
  photo: string | null;
  img: string | null;
  status: "active" | "hidden";
  parent: string | null;
};

const CAT_SEED: [string, string, string, number, string, string, string | null][] = [
  ["Broiler Poultry", "poultry", "Chickens, turkey, ducks and more.", 12, "🐔", "#f6e3de", "1633096013004-e2cb4023b560"],
  ["Commercial Feeds", "feeds", "Animal feeds and supplements.", 8, "🌾", "#f3e6d4", null],
  ["Aquaculture & Fish", "aquaculture", "Fish, fingerlings and accessories.", 16, "🐟", "#dfe8f7", null],
  ["Organic Vegetables", "vegetables", "Fresh and healthy produce.", 5, "🥬", "#e6f0de", "1635450370155-d6a650322fa5"],
];
const NEW_CAT_LOOK: [string, string][] = [["📦", "#efece4"], ["🧺", "#f3e6d4"], ["🌱", "#e6f0de"], ["🛒", "#dfe8f7"], ["🍯", "#f7ecd2"]];

export function generateCategories(site: SiteLite): Category[] {
  return CAT_SEED.map(([name, slug, desc, count, emoji, tint, photo], i) => ({
    id: `${site.id}c${i}`,
    name,
    slug,
    desc,
    count,
    emoji,
    tint,
    photo,
    img: null,
    status: "active" as const,
    parent: null,
  }));
}

const catItems = (n: number) => `${n} ${n === 1 ? "Item" : "Items"}`;

export function CategoriesView({
  site,
  categories,
  setCategories,
  showToast,
  showToastAction,
  onViewProducts,
}: {
  site: SiteLite;
  categories: Category[];
  setCategories: (updater: (list: Category[]) => Category[]) => void;
  showToast: (text: string) => void;
  showToastAction: (text: string, label: string, action: () => void) => void;
  onViewProducts: (c: Category) => void;
}) {
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ open: boolean; edit: Category | null }>({ open: false, edit: null });

  const PER = 8;
  const pages = Math.max(1, Math.ceil(categories.length / PER));
  const cur = Math.min(Math.max(1, page), pages);
  const start = (cur - 1) * PER;
  const rows = categories.slice(start, start + PER);

  const openDialog = (edit: Category | null) => setDialog({ open: true, edit });

  const toggleStatus = (c: Category) => {
    const now: "active" | "hidden" = c.status === "active" ? "hidden" : "active";
    setCategories((list) => list.map((x) => (x.id === c.id ? { ...x, status: now } : x)));
    showToast(`${c.name} ${now === "active" ? "is now shown in the store" : "is hidden from the store"}`);
  };

  const remove = (c: Category) => {
    const i = categories.findIndex((x) => x.id === c.id);
    if (i < 0) return;
    const kids = categories.filter((x) => x.parent === c.id).map((x) => x.id);
    setCategories((list) => list.filter((x) => x.id !== c.id).map((x) => (kids.includes(x.id) ? { ...x, parent: null } : x)));
    showToastAction(`${c.name} deleted`, "Undo", () =>
      setCategories((list) => {
        const restored = [...list];
        restored.splice(Math.min(i, restored.length), 0, c);
        return restored.map((x) => (kids.includes(x.id) ? { ...x, parent: c.id } : x));
      }),
    );
  };

  return (
    <>
      <div className="ov-head">
        <h1 tabIndex={-1} className="sv-title">
          E-Commerce / Store <span className="engine" title="Store engine connected">{I_CHECK_C}Medusa</span>
        </h1>
        <p>Manage your products, inventory, order lists, and payment channel toggles.</p>
      </div>

      <section className="ov-card pcard ccard" aria-labelledby="cc-t">
        <header className="pcard-head ccard-head">
          <div>
            <h2 id="cc-t">Product Categories</h2>
            <p>Organize your store catalog into collections</p>
          </div>
          <div className="ccard-tools">
            <button type="button" className="btn-dark sv-add" onClick={() => openDialog(null)}>
              {icon("i-plus", 14, 14, "0 0 18 18")}
              Add Category
            </button>
          </div>
        </header>

        <div className="ctab" role="table" aria-label="Product categories">
          <div className="ctab-row head" role="row">
            <span role="columnheader">Category Name</span>
            <span role="columnheader">Slug</span>
            <span role="columnheader">Products Assigned</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Actions</span>
          </div>
          <div id="cat-rows" role="rowgroup">
            {rows.map((c) => {
              const parent = c.parent ? categories.find((x) => x.id === c.parent) : null;
              const thumb = c.img || (c.photo ? photoUrl(c.photo) : null);
              return (
                <div className="ctab-row" role="row" key={c.id}>
                  <span className="ccell" role="cell">
                    <span className="cthumb" style={{ "--tb": c.tint } as CSSProperties} aria-hidden="true">
                      {c.emoji}
                      {thumb ? <img src={thumb} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} /> : null}
                    </span>
                    <span className="ptxt">
                      <strong>{c.name}</strong>
                      {parent ? <small className="cparent">In {parent.name}</small> : null}
                      <small>{c.desc || "No description yet."}</small>
                      <small className="pmeta">/{c.slug} · {catItems(c.count)}</small>
                    </span>
                  </span>
                  <span className="c-slug" role="cell">/{c.slug}</span>
                  <span className="c-count" role="cell">{catItems(c.count)}</span>
                  <span className="c-cstatus" role="cell">
                    <span className={`cpill${c.status === "active" ? "" : " off"}`}>{c.status === "active" ? "Active" : "Hidden"}</span>
                  </span>
                  <span className="c-act" role="cell">
                    <button type="button" className="edit-btn" aria-label={`Edit ${c.name}`} onClick={() => openDialog(c)}>
                      {icon("i-edit", 12)}
                      Edit
                    </button>
                    <MoreMenu
                      ariaLabel={`More actions for ${c.name}`}
                      items={[
                        { kind: "item", label: "View products", onSelect: () => onViewProducts(c) },
                        { kind: "item", label: c.status === "active" ? "Hide from store" : "Show in store", onSelect: () => toggleStatus(c) },
                        { kind: "divider" },
                        { kind: "item", label: "Delete category", danger: true, onSelect: () => remove(c) },
                      ]}
                    />
                  </span>
                </div>
              );
            })}
            {rows.length === 0 ? (
              <div className="tab-empty">
                <strong>No categories yet</strong>
                Group your products into collections so shoppers can browse them.
                <br />
                <button type="button" className="btn-dark" onClick={() => openDialog(null)}>
                  {icon("i-plus", 14, 14, "0 0 18 18")}
                  Add Category
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="sv-foot" id="cat-foot">
        <span>
          {categories.length
            ? `Showing ${start + 1} - ${start + rows.length} of ${categories.length} ${categories.length === 1 ? "category" : "categories"}`
            : "Showing 0 categories"}
        </span>
        {categories.length > PER ? <Pager current={cur} pages={pages} label="Category pages" onChange={setPage} /> : null}
      </div>

      {dialog.open ? (
        <CategoryDialog
          key={dialog.edit?.id ?? "new"}
          categories={categories}
          edit={dialog.edit}
          onCancel={() => setDialog({ open: false, edit: null })}
          onSubmit={(data, edit) => {
            if (edit) {
              setCategories((list) => list.map((x) => (x.id === edit.id ? { ...x, ...data } : x)));
              setDialog({ open: false, edit: null });
              showToast(`${data.name} updated`);
            } else {
              const [emoji, tint] = NEW_CAT_LOOK[categories.length % NEW_CAT_LOOK.length];
              setCategories((list) => [
                ...list,
                { id: site.id + "c" + Date.now(), count: 0, emoji, tint, photo: null, status: "active", ...data },
              ]);
              setPage(Math.ceil((categories.length + 1) / PER));
              setDialog({ open: false, edit: null });
              showToast(`${data.name} category created`);
            }
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------- create/edit category */

function CategoryDialog({
  categories,
  edit,
  onCancel,
  onSubmit,
}: {
  categories: Category[];
  edit: Category | null;
  onCancel: () => void;
  onSubmit: (data: { name: string; slug: string; parent: string | null; desc: string; img: string | null }, edit: Category | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);
  const [name, setName] = useState(edit?.name ?? "");
  const [slug, setSlug] = useState(edit?.slug ?? "");
  const [parent, setParent] = useState(edit?.parent ?? "");
  const [desc, setDesc] = useState(edit?.desc ?? "");
  const [img, setImg] = useState<string | null>(edit?.img ?? null);
  const [imgErr, setImgErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [slugEdited, setSlugEdited] = useState(!!edit);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* Same StrictMode-aware close guard as ProductDialog / PageDialog. */
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    nameRef.current?.focus();
    return () => {
      if (d.open) closingRef.current = true;
      d.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    onCancel();
  };

  const clearErr = (id: string) => setErrors((e) => (e[id] ? { ...e, [id]: "" } : e));

  const take = (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      setImgErr("Use a JPG or PNG image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImgErr("That image is over 5MB. Pick a smaller one.");
      return;
    }
    setImgErr("");
    const r = new FileReader();
    r.onload = () => setImg(String(r.result));
    r.readAsDataURL(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().replace(/^-+|-+$/g, "");
    const next: Record<string, string> = {};
    let first: string | null = null;
    const bad = (id: string, msg: string) => {
      next[id] = msg;
      first ??= id;
    };
    if (!trimmedName) bad("cf-name", "Give the category a name.");
    else if (categories.some((x) => x !== edit && x.name.toLowerCase() === trimmedName.toLowerCase()))
      bad("cf-name", `You already have a category called ${trimmedName}.`);
    if (!trimmedSlug) bad("cf-slug", "Add a URL slug, e.g. broiler-poultry.");
    else if (categories.some((x) => x !== edit && x.slug === trimmedSlug))
      bad("cf-slug", `/${trimmedSlug} is already used by another category.`);
    setErrors(next);
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    onSubmit({ name: trimmedName, slug: trimmedSlug, parent: parent || null, desc: desc.trim(), img }, edit);
  };

  const err = (id: string) => errors[id] || "";
  /* A category can't be its own parent, or the parent of its own parent. */
  const parentOpts = categories.filter((x) => !edit || (x.id !== edit.id && x.parent !== edit.id));

  return (
    <dialog
      className="modal modal-product"
      ref={ref}
      aria-labelledby="cf-title"
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <form noValidate onSubmit={submit}>
        <div className="pf-head">
          <div>
            <h2 id="cf-title">{edit ? "Edit Product Category" : "Create Product Category"}</h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
            {icon("i-close", 18, 18, "0 0 16 16")}
          </button>
        </div>

        <label
          className={`pf-drop${img ? " has-img" : ""}${drag ? " drag" : ""}`}
          id="cf-drop"
          onDragEnter={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            take(e.dataTransfer.files?.[0]);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            aria-label="Upload category image"
            onChange={(e) => {
              take(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <svg className="pf-dash" aria-hidden="true">
            <rect x=".5" y=".5" rx="12" ry="12" />
          </svg>
          <span id="cf-drop-body" style={{ display: "contents" }}>
            {img ? (
              <img src={img} alt="Category image preview" />
            ) : (
              <>
                {I_CLOUD}
                <strong>Upload category image</strong>
                <small>Drag and drop an image, or click to browse</small>
                <small>JPG, PNG (max 5MB)</small>
              </>
            )}
          </span>
        </label>

        <div className="pf-imgbar" hidden={!img}>
          <button type="button" className="btn-text" onClick={() => fileRef.current?.click()}>Replace image</button>
          <button type="button" className="btn-text" onClick={() => setImg(null)}>Remove</button>
        </div>
        <p className="pf-err" role="alert" hidden={!imgErr} style={{ textAlign: "center" }}>{imgErr}</p>

        <div className="pf-fields cf-fields">
          <div className="pf-field">
            <label htmlFor="cf-name">Category Name<span className="req" aria-hidden="true">*</span></label>
            <input
              ref={nameRef}
              className="pf-input"
              id="cf-name"
              maxLength={60}
              autoComplete="off"
              placeholder="e.g. Broiler Poultry"
              required
              value={name}
              aria-invalid={!!err("cf-name")}
              aria-describedby={err("cf-name") ? "cf-name-err" : undefined}
              onChange={(e) => {
                clearErr("cf-name");
                setName(e.target.value);
                if (!slugEdited) {
                  setSlug(slugify(e.target.value).slice(0, 60));
                  clearErr("cf-slug");
                }
              }}
            />
            <p className="pf-err" id="cf-name-err" role="alert" hidden={!err("cf-name")}>{err("cf-name")}</p>
          </div>

          <div className="pf-field">
            <label htmlFor="cf-slug">
              URL Slug <span className="opt-note">(Auto-generated)</span>:<span className="req" aria-hidden="true">*</span>
            </label>
            <div className="pf-box" aria-invalid={!!err("cf-slug")}>
              <span aria-hidden="true">/</span>
              <input
                id="cf-slug"
                autoComplete="off"
                spellCheck={false}
                maxLength={60}
                placeholder="broiler-poultry"
                required
                value={slug}
                aria-describedby={err("cf-slug") ? "cf-slug-err" : undefined}
                onChange={(e) => {
                  setSlugEdited(true);
                  clearErr("cf-slug");
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-"));
                }}
              />
            </div>
            <p className="pf-err" id="cf-slug-err" role="alert" hidden={!err("cf-slug")}>{err("cf-slug")}</p>
          </div>

          <div className="pf-field">
            <label htmlFor="cf-parent">Parent Category <span className="opt-note">(Optional)</span></label>
            <select className="pf-input" id="cf-parent" value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">None (Top-Level Category)</option>
              {parentOpts.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </div>

          <div className="pf-field">
            <label htmlFor="cf-desc">Description</label>
            <textarea
              className="pf-input"
              id="cf-desc"
              maxLength={500}
              placeholder="Short description of this category..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <p className="pf-count" aria-live="polite">{desc.length}/500</p>
          </div>
        </div>

        <div className="pf-foot">
          <button type="button" className="btn-outline pf-btn" onClick={() => ref.current?.close()}>Cancel</button>
          <button type="submit" className="btn-primary pf-btn">{edit ? "Save Changes" : "Create"}</button>
        </div>
      </form>
    </dialog>
  );
}

/* ------------------------- Checkout Settings + shipping rate dialog */

/* E-Commerce / Store → Checkout Settings (#/overview/checkout) and its
   Add / edit shipping rate dialog. Markup, copy, validation messages and
   the seeded gateways / zones mirror renderCheckoutView() and the #dlg-ship
   flow in digital-romanian-screen.html one-for-one. Like the other site
   screens, the gateway + zone data lives in the route component (as props)
   so edits survive moving between the store views; clicks are React
   handlers instead of delegated [data-*] lookups. */

export type ShippingZone = {
  id: string;
  name: string;
  type: "flat" | "free" | "weight";
  amount: number;
  eta: string;
  regions: string[];
};

export type Checkout = {
  gateways: { paystack: { on: boolean; keys: string }; cod: { on: boolean } };
  zones: ShippingZone[];
};

const BASE_REGIONS = ["Ikeja", "Surulere", "Yaba", "Agege", "Lekki", "Victoria Island"];
const SHIP_ETAS = ["Same day", "24 – 48 Hours", "2 – 3 Days", "3 – 5 Days", "5 – 7 Days", "1 – 2 Weeks"];
const naira = (n: number) => "₦" + Number(n).toLocaleString("en-NG", { maximumFractionDigits: 2 });
const parseAmt = (v: string) => {
  const n = parseFloat(String(v).replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? NaN : n;
};
const isShopSite = (s: SiteLite) => s.theme === "alicia" || s.theme === "sun";

/* checkoutOf(s) - the deterministic demo gateways / shipping zones. */
export function generateCheckout(site: SiteLite): Checkout {
  const shop = isShopSite(site);
  return {
    gateways: { paystack: { on: shop, keys: "" }, cod: { on: false } },
    zones: shop
      ? [
          { id: site.id + "z0", name: "Lagos Mainland / Island Flat Rate", type: "flat", amount: 2500, eta: "24 – 48 Hours", regions: ["Ikeja", "Surulere", "Yaba", "Lekki", "Victoria Island"] },
          { id: site.id + "z1", name: "Interstate Deliveries", type: "weight", amount: 0, eta: "3 – 5 Days", regions: ["All other states"] },
        ]
      : [],
  };
}

export function CheckoutView({
  site,
  checkout,
  setCheckout,
  showToast,
  showToastAction,
}: {
  site: SiteLite;
  checkout: Checkout;
  setCheckout: (updater: (c: Checkout) => Checkout) => void;
  showToast: (text: string) => void;
  showToastAction: (text: string, label: string, action: () => void) => void;
}) {
  const [ship, setShip] = useState<{ edit: ShippingZone | null } | null>(null);
  const [keyDraft, setKeyDraft] = useState(checkout.gateways.paystack.keys);

  useEffect(() => {
    setKeyDraft(checkout.gateways.paystack.keys);
  }, [checkout.gateways.paystack.keys]);

  const g = checkout.gateways;

  const toggleGateway = (k: "paystack" | "cod", checked: boolean) => {
    if (!checked && Object.entries(g).every(([x, gg]) => x === k || !gg.on)) {
      showToast("Keep at least one payment method on so customers can pay.");
      return;
    }
    setCheckout((c) =>
      k === "cod"
        ? { ...c, gateways: { ...c.gateways, cod: { on: checked } } }
        : { ...c, gateways: { ...c.gateways, paystack: { ...c.gateways.paystack, on: checked } } },
    );
    showToast(`${k === "cod" ? "Cash on Delivery / Bank Transfer" : "Paystack / Flutterwave"} ${checked ? "turned on" : "turned off"}`);
  };

  const saveKey = () => {
    const v = keyDraft.trim();
    if (!v || v === g.paystack.keys) return;
    if (!/^pk_(test|live)_\w{6,}$/.test(v)) {
      showToast("Paste your public key. It starts with pk_live_ or pk_test_");
      return;
    }
    const masked = v.slice(0, 8) + "••••" + v.slice(-4);
    setCheckout((c) => ({ ...c, gateways: { ...c.gateways, paystack: { on: true, keys: masked } } }));
    showToast("Payment keys saved. Paystack / Flutterwave is active.");
  };

  const removeZone = (z: ShippingZone) => {
    const i = checkout.zones.findIndex((x) => x.id === z.id);
    if (i < 0) return;
    setCheckout((c) => ({ ...c, zones: c.zones.filter((x) => x.id !== z.id) }));
    showToastAction(`${z.name} deleted`, "Undo", () =>
      setCheckout((c) => {
        const back = [...c.zones];
        back.splice(Math.min(i, back.length), 0, z);
        return { ...c, zones: back };
      }),
    );
  };

  const zonePrice = (z: ShippingZone) =>
    z.type === "flat" ? (
      <span className="zp">{naira(z.amount)}</span>
    ) : z.type === "free" ? (
      <span className="zp">Free{z.amount ? ` over ${naira(z.amount)}` : ""}</span>
    ) : (
      <span className="zp calc">Calculated at checkout</span>
    );

  return (
    <>
      <div className="ov-head">
        <h1 tabIndex={-1} className="sv-title">
          E-Commerce / Store <span className="engine" title="Store engine connected">{I_CHECK_C}Medusa</span>
        </h1>
        <p>Manage your products, inventory, order lists, and payment channel toggles.</p>
      </div>

      <section className="ov-card ck-card" aria-labelledby="ck-t">
        <header>
          <h2 id="ck-t">Checkout &amp; Payment Settings</h2>
          <p>Configure how your customers pay and how orders are shipped.</p>
        </header>

        <h3 className="ck-sec">Payment Gateway <small>(Powered by Medusa)</small></h3>
        <div className="ck-box">
          <div className="gw">
            <div className="gw-main">
              <input type="checkbox" className="gcheck" id="gw-paystack" checked={g.paystack.on} onChange={(e) => toggleGateway("paystack", e.target.checked)} />
              <label htmlFor="gw-paystack">
                <strong>Paystack / Flutterwave</strong>
                <span className={`st${g.paystack.on ? "" : " off"}`}>({g.paystack.on ? "Active" : "Inactive"})</span>
                <small>(Accept local cards, bank transfers, USSD, and mobile money in Nigeria)</small>
              </label>
            </div>
            <div className="gw-keys">
              <label className="sr-only" htmlFor="gw-key">Paystack public key</label>
              <input
                id="gw-key"
                className={g.paystack.keys ? "saved-key" : ""}
                placeholder="Configure Keys"
                autoComplete="off"
                spellCheck={false}
                value={keyDraft}
                title="Paste your public key (pk_live_… or pk_test_…) and press Enter"
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveKey();
                  }
                }}
                onFocus={(e) => {
                  if (e.target.value.includes("•")) e.target.select();
                }}
              />
            </div>
          </div>
          <div className="gw">
            <div className="gw-main">
              <input type="checkbox" className="gcheck" id="gw-cod" checked={g.cod.on} onChange={(e) => toggleGateway("cod", e.target.checked)} />
              <label htmlFor="gw-cod">
                <strong>Cash on Delivery / Bank Transfer</strong>
                <span className="st off">(Manual verification)</span>
              </label>
            </div>
          </div>
        </div>

        <h3 className="ck-sec">Shipping Zones &amp; Rates</h3>
        <div className="ck-box zones">
          <ul className="zlist">
            {checkout.zones.map((z) => (
              <li key={z.id}>
                <button
                  type="button"
                  className="zone"
                  title={`${z.regions.join(", ")} · ${z.eta}`}
                  aria-label={`Edit ${z.name}`}
                  onClick={() => setShip({ edit: z })}
                >
                  <span className="zn"><span>{z.name}:</span></span>
                  {zonePrice(z)}
                </button>
              </li>
            ))}
          </ul>
          {checkout.zones.length ? null : (
            <div className="tab-empty" style={{ padding: "20px 8px" }}>
              <strong>No shipping rates yet</strong>
              Add at least one rate so customers can check out.
            </div>
          )}
          <div className="zfoot">
            <button type="button" className="btn-light" onClick={() => setShip({ edit: null })}>
              {icon("i-plus", 14, 14, "0 0 18 18")}
              Add Shipping
            </button>
          </div>
        </div>
      </section>

      {ship ? (
        <ShipDialog
          key={ship.edit?.id ?? "new"}
          zones={checkout.zones}
          edit={ship.edit}
          onCancel={() => setShip(null)}
          onDelete={(z) => {
            setShip(null);
            removeZone(z);
          }}
          onSubmit={(data, edit) => {
            if (edit) {
              setCheckout((c) => ({ ...c, zones: c.zones.map((z) => (z.id === edit.id ? { ...z, ...data } : z)) }));
              setShip(null);
              showToast(`${data.name} updated`);
            } else {
              setCheckout((c) => ({ ...c, zones: [...c.zones, { id: site.id + "z" + Date.now(), ...data }] }));
              setShip(null);
              showToast(`${data.name} added`);
            }
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------- add/edit shipping rate */

function ShipDialog({
  zones,
  edit,
  onCancel,
  onDelete,
  onSubmit,
}: {
  zones: ShippingZone[];
  edit: ShippingZone | null;
  onCancel: () => void;
  onDelete: (z: ShippingZone) => void;
  onSubmit: (data: { name: string; type: ShippingZone["type"]; amount: number; eta: string; regions: string[] }, edit: ShippingZone | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const flatRef = useRef<HTMLInputElement>(null);
  const minRef = useRef<HTMLInputElement>(null);
  const regionsRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  const [name, setName] = useState(edit?.name ?? "");
  const [type, setType] = useState<ShippingZone["type"]>(edit?.type ?? "flat");
  const [flat, setFlat] = useState(edit?.type === "flat" ? Number(edit.amount).toLocaleString("en-NG") : "2,500");
  const [min, setMin] = useState(edit?.type === "free" && edit.amount ? Number(edit.amount).toLocaleString("en-NG") : "");
  const [eta, setEta] = useState(edit?.eta ?? "24 – 48 Hours");
  const [picked, setPicked] = useState<string[]>(edit?.regions ?? ["Ikeja", "Surulere"]);
  const [errors, setErrors] = useState<{ name?: string; price?: string; region?: string }>({});

  /* Region list: the first four base regions plus any of the edited zone's
     own regions; a zone that reaches "All other states" keeps that option. */
  const regionOpts = Array.from(
    new Set([...BASE_REGIONS.slice(0, 4), ...(edit ? edit.regions.filter((r) => r !== "All other states") : [])]),
  );
  if (edit?.regions.includes("All other states")) regionOpts.push("All other states");

  /* Same StrictMode-aware close guard as ProductDialog / PageDialog. */
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    nameRef.current?.focus();
    return () => {
      if (d.open) closingRef.current = true;
      d.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    onCancel();
  };

  const clearErr = (id: "name" | "price" | "region") => setErrors((e) => (e[id] ? { ...e, [id]: "" } : e));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const next: typeof errors = {};
    let first: HTMLElement | null = null;
    if (!trimmed) {
      next.name = "Give this rate a name, e.g. Lagos Mainland Express.";
      first = first ?? nameRef.current;
    } else if (zones.some((z) => z.id !== edit?.id && z.name.toLowerCase() === trimmed.toLowerCase())) {
      next.name = `You already have a rate called ${trimmed}.`;
      first = first ?? nameRef.current;
    }
    let amount = 0;
    if (type === "flat") {
      amount = parseAmt(flat);
      if (!(amount > 0)) {
        next.price = "Enter the flat rate in naira, e.g. 2,500.";
        first = first ?? flatRef.current;
      }
    } else if (type === "free") {
      const v = min.trim();
      amount = v ? parseAmt(v) : 0;
      if (v && !(amount > 0)) {
        next.price = "Enter a minimum order amount, or leave it empty to make shipping free on every order.";
        first = first ?? minRef.current;
      }
    }
    if (!picked.length) {
      next.region = "Pick at least one region this rate applies to.";
      first = first ?? (regionsRef.current?.querySelector("input") as HTMLInputElement | null);
    }
    setErrors(next);
    if (first) {
      first.focus();
      return;
    }
    onSubmit({ name: trimmed, type, amount: Math.round(amount * 100) / 100, eta, regions: picked }, edit);
  };

  return (
    <dialog
      className="modal modal-product modal-ship"
      ref={ref}
      aria-labelledby="sr-title"
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <form id="sr-form" noValidate onSubmit={submit}>
        <div className="pf-head">
          <h2 id="sr-title">{edit ? "Edit Shipping Rate" : "Add Shipping Rate"}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
            {icon("i-close", 18, 18, "0 0 16 16")}
          </button>
        </div>

        <div className="sr-field pf-field">
          <label htmlFor="sr-name">Rate Title / Zone Name:</label>
          <input
            ref={nameRef}
            className="pf-input"
            id="sr-name"
            maxLength={60}
            autoComplete="off"
            placeholder="e.g. Lagos Mainland Express Delivery"
            value={name}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "sr-name-err" : undefined}
            onChange={(e) => {
              clearErr("name");
              setName(e.target.value);
            }}
          />
          <p className="pf-err" id="sr-name-err" role="alert" hidden={!errors.name}>{errors.name}</p>
        </div>

        <fieldset className="sr-field">
          <legend>Pricing Type:</legend>
          <div className="ptype">
            <div className="pt">
              <label className="r">
                <input type="radio" className="gradio" name="sr-type" value="flat" checked={type === "flat"} onChange={() => { setType("flat"); clearErr("price"); }} />
                Flat Rate:
              </label>
              <span className={`amt${type !== "flat" ? " dim" : ""}`} id="sr-flat-box" aria-invalid={!!(errors.price && type === "flat")}>
                <span aria-hidden="true">₦</span>
                <input
                  ref={flatRef}
                  id="sr-flat"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label="Flat rate in naira"
                  value={flat}
                  disabled={type !== "flat"}
                  onChange={(e) => {
                    clearErr("price");
                    setFlat(e.target.value.replace(/[^\d.,]/g, ""));
                  }}
                />
              </span>
            </div>
            <div className="pt">
              <label className="r">
                <input type="radio" className="gradio" name="sr-type" value="free" checked={type === "free"} onChange={() => { setType("free"); clearErr("price"); }} />
                Free Shipping
              </label>
              <span className="hint" id="sr-free-hint">(Orders above a certain amount)</span>
            </div>
            <div className="pt" id="sr-min-row" hidden={type !== "free"}>
              <span className="hint" style={{ paddingLeft: 20 }}>Free on orders above</span>
              <span className={`amt${type !== "free" ? " dim" : ""}`} id="sr-min-box" aria-invalid={!!(errors.price && type === "free")}>
                <span aria-hidden="true">₦</span>
                <input
                  ref={minRef}
                  id="sr-min"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label="Minimum order for free shipping"
                  placeholder="20,000"
                  value={min}
                  disabled={type !== "free"}
                  onChange={(e) => {
                    clearErr("price");
                    setMin(e.target.value.replace(/[^\d.,]/g, ""));
                  }}
                />
              </span>
            </div>
            <div className="pt">
              <label className="r">
                <input type="radio" className="gradio" name="sr-type" value="weight" checked={type === "weight"} onChange={() => { setType("weight"); clearErr("price"); }} />
                Weight-Based
              </label>
              <span className="hint">(Calculated via Medusa engine)</span>
            </div>
          </div>
          <p className="pf-err" id="sr-price-err" role="alert" hidden={!errors.price}>{errors.price}</p>
        </fieldset>

        <div className="sr-field">
          <label htmlFor="sr-eta">Estimated Delivery Timeframe:</label>
          <select className="pf-input" id="sr-eta" value={eta} onChange={(e) => setEta(e.target.value)}>
            {SHIP_ETAS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <fieldset className="sr-field">
          <legend>Available to Regions:</legend>
          <div className="regions" id="sr-regions" ref={regionsRef}>
            {regionOpts.map((r) => (
              <label key={r}>
                <input
                  type="checkbox"
                  className="gcheck"
                  value={r}
                  checked={picked.includes(r)}
                  onChange={(e) => {
                    clearErr("region");
                    setPicked((list) => (e.target.checked ? [...list, r] : list.filter((x) => x !== r)));
                  }}
                />
                {r}
              </label>
            ))}
          </div>
          <p className="sr-note">(Select districts or enter statewide rule)</p>
          <p className="pf-err" id="sr-region-err" role="alert" hidden={!errors.region}>{errors.region}</p>
        </fieldset>

        <div className="pf-foot">
          {edit ? (
            <button type="button" className="btn-text sr-del" onClick={() => onDelete(edit)}>Delete rate</button>
          ) : null}
          <button type="button" className="btn-outline pf-btn" onClick={() => ref.current?.close()}>Cancel</button>
          <button type="submit" className="btn-primary pf-btn" id="sr-submit">Save Rate</button>
        </div>
      </form>
    </dialog>
  );
}

/* =====================================================================
   Site Analytics (#/overview/analytics) + Site Settings (#/overview/settings)
   Ported one-for-one from renderAnalyticsView() / renderSettingsView() and the
   #dlg-domain → #dlg-dns flow in digital-romanian-screen.html.
   ===================================================================== */

const DAY_MS = 24 * 60 * 60 * 1000;

/* Daily page views for the last 30 days (shape matches the design). */
const TREND30 = [
  900, 1150, 1050, 1650, 1850, 1900, 2000, 1950, 1750, 2150, 2450, 2650, 2300, 1700, 2000,
  2500, 2700, 2550, 2450, 2550, 2600, 2600, 2650, 2800, 2700, 2850, 3000, 2900, 3050, 3350,
];
const VISIT_RATIO = 14820 / TREND30.reduce((a, b) => a + b, 0);
const DELTAS: Record<number, [number, number, number]> = { 7: [4.1, 3.6, 2.9], 30: [12.4, 10.2, 8.2], 90: [18.7, 15.3, 11.6] };
const CONV: Record<number, number> = { 7: 2.6, 30: 2.4, 90: 2.2 };
const TF_LABEL: Record<number, string> = { 7: "Last 7 Days", 30: "Last 30 Days", 90: "Last 90 Days" };
type AnDay = 7 | 30 | 90;
const AN_DAYS: AnDay[] = [7, 30, 90];

const TOP_SELLERS = [
  { name: "Whole Broiler Chicken", base: 84, emoji: "🍗", tint: "#f6e3de", photo: "1633096013004-e2cb4023b560" },
  { name: "New Hope Feed 510", base: 32, emoji: "🌾", tint: "#f3e6d4", photo: "1574323347407-f5e1ad6d020b" },
  { name: "Fresh Catfish (Live)", base: 19, emoji: "🐟", tint: "#dfe8f7", photo: "1534043464124-3be32fe000c9" },
];
const PAGE_SHARE = [6200, 4100, 1800].map((v) => v / 14820);
const PAGE_TINT = ["#7a2e12", "#2f4f6f", "#2e7d4a"];

const seedOf = (str: string) => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const fmtN = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

function niceMax(v: number) {
  const raw = (Math.max(v, 1) * 1.08) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? 10 * mag;
  return step * 4;
}
const kfmt = (v: number) => (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + "k" : String(v));

const svgStroke = (paths: ReactNode, w = 18, vb = "0 0 16 16") => (
  <svg width={w} height={w} viewBox={vb} fill="none" aria-hidden="true">
    {paths}
  </svg>
);

/* KI glyphs from renderAnalyticsView(). */
const K_ICONS: Record<string, ReactNode> = {
  eye: svgStroke(
    <>
      <path d="M1.5 8S3.9 3.5 8 3.5 14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
    </>,
  ),
  users: svgStroke(
    <>
      <circle cx="6" cy="5.5" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.75 13.5c0-2.5 1.9-4 4.25-4s4.25 1.5 4.25 4M11 3.3a2.3 2.3 0 0 1 0 4.4M12.3 9.7c1.2.6 2 1.9 2 3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>,
  ),
  bars: svgStroke(
    <>
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.25 11V8M8 11V5.5M10.75 11V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>,
  ),
  conv: svgStroke(
    <>
      <path d="M12.5 5.5A5 5 0 0 0 3.6 4.4M3.5 10.5a5 5 0 0 0 8.9 1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12.75 2.75v2.9h-2.9M3.25 13.25v-2.9h2.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 5.75v4.5M6.6 6.9h2.1a.8.8 0 0 1 0 1.6H7.3a.8.8 0 0 0 0 1.6h2.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </>,
  ),
};
const CAL = svgStroke(
  <>
    <rect x="2.25" y="3" width="11.5" height="10.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M2.25 6.5h11.5M5.5 1.75v2.5M10.5 1.75v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </>,
  15,
);
const DL = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 2.5v8M4.8 7.5 8 10.7l3.2-3.2M2.5 13.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type AnPoint = { date: Date; views: number; visits: number };

function anSeries(site: SiteLite, days: AnDay): AnPoint[] {
  const seed = seedOf(site.id);
  const scale = site.id === "s1" ? 1 : 0.3 + (seed % 55) / 100;
  let views = TREND30.slice();
  if (days > 30) {
    const pre = Array.from({ length: days - 30 }, (_, i) => 550 + i * 7 + 260 * Math.sin(i / 3.6) + rnd(seed + i) * 220);
    views = pre.concat(views);
  } else {
    views = views.slice(-days);
  }
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return views.map((v, i) => {
    const jitter = site.id === "s1" ? 1 : 0.88 + rnd(seed * 3 + i) * 0.24;
    const pv = Math.round(v * scale * jitter);
    return { date: new Date(today.getTime() - (views.length - 1 - i) * DAY_MS), views: pv, visits: Math.round(pv * VISIT_RATIO) };
  });
}

function anCompute(site: SiteLite, days: AnDay) {
  const ser = anSeries(site, days);
  const shop = isShopSite(site);
  const visits = Math.round(ser.reduce((a, d) => a + d.views, 0) * VISIT_RATIO);
  const k = visits / 14820;
  return {
    ser,
    visits,
    shop,
    unique: Math.round((visits * 11104) / 14820),
    revenue: shop ? Math.round((visits * 482500) / 14820 / 100) * 100 : 0,
    conv: shop ? CONV[days] : 0,
    dl: DELTAS[days],
    pages: generatePages(site).slice(0, 3).map((p, i) => ({ ...p, views: Math.round(visits * PAGE_SHARE[i]) })),
    sellers: shop ? TOP_SELLERS.map((p) => ({ ...p, sold: Math.max(1, Math.round(p.base * k)) })) : [],
  };
}

/* drawChart(): the live trend chart, as a React SVG. The series carries dates
   computed from `new Date()`, so the plot is measured and drawn only after
   mount (dims.w stays 0 on the server) to keep SSR deterministic. */
function TrafficChart({ series, metric, days }: { series: AnPoint[]; metric: "views" | "visits"; days: AnDay }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 210 });
  const [idx, setIdx] = useState(-1);
  const [tipX, setTipX] = useState(0);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setDims({ w: Math.max(box.clientWidth, 280), h: box.clientHeight || 210 });
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(box);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const n = series.length;
  const W = dims.w;
  const H = dims.h;
  const pl = 34;
  const pr = 14;
  const pt = 10;
  const pb = 30;
  const iw = W - pl - pr;
  const ih = H - pt - pb;
  const x = (i: number) => pl + (n === 1 ? iw / 2 : (i * iw) / (n - 1));

  useEffect(() => {
    if (idx < 0) return;
    const half = (tipRef.current?.offsetWidth ?? 0) / 2;
    const px = x(idx);
    setTipX(Math.min(Math.max(px, half), W - half));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, W, H, n]);

  if (!W || n < 1) return <div className="an-plot" ref={boxRef} />;

  const vals = series.map((d) => d[metric]);
  const max = niceMax(Math.max(...vals));
  const y = (v: number) => pt + ih - (v / max) * ih;
  const pts = vals.map((v, i) => [x(i), y(v)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)} ${(pt + ih).toFixed(1)} L${pl} ${(pt + ih).toFixed(1)} Z`;
  const every = Math.ceil(n / (W < 520 ? 5 : 10));

  const grid: ReactNode[] = [];
  for (let t = 0; t <= 4; t++) {
    const v = (max / 4) * t;
    const yy = y(v);
    grid.push(
      <g key={`g${t}`}>
        <line className="gl" x1={pl} x2={W - pr} y1={yy} y2={yy} />
        <text className="yl" x={pl - 10} y={yy + 4} textAnchor="end">{kfmt(v)}</text>
      </g>,
    );
  }
  const xlabels: ReactNode[] = [];
  for (let i = n - 1; i >= 0; i -= every) {
    xlabels.unshift(
      <text key={`x${i}`} className="xl" x={x(i)} y={H - 6} textAnchor="middle">{fmtDay(series[i].date)}</text>,
    );
  }
  const dots = n <= 45 ? pts.map((p, i) => <circle key={`d${i}`} className="dt" cx={p[0]} cy={p[1]} r="2.6" />) : null;
  const label = metric === "views" ? "page views" : "visits";
  const total = vals.reduce((a, b) => a + b, 0);
  const aria = `Daily ${label}, ${TF_LABEL[days].toLowerCase()}: ${fmtN(total)} in total, peaking at ${fmtN(Math.max(...vals))}. Use the arrow keys to read each day.`;

  const cur = idx >= 0 && idx < n ? idx : -1;
  const hp = cur >= 0 ? pts[cur] : null;
  const cd = cur >= 0 ? series[cur] : null;

  const fromEvent = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = r.width ? (e.clientX - r.left) / r.width : 0;
    setIdx(Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1)))));
  };
  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const base = idx < 0 || idx >= n ? n - 1 : idx;
    setIdx(e.key === "Home" ? 0 : e.key === "End" ? n - 1 : Math.max(0, Math.min(n - 1, base + (e.key === "ArrowRight" ? 1 : -1))));
  };

  return (
    <div className="an-plot" ref={boxRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        tabIndex={0}
        role="img"
        aria-label={aria}
        onKeyDown={onKey}
        onFocus={() => setIdx(idx >= 0 && idx < n ? idx : n - 1)}
        onBlur={() => setIdx(-1)}
      >
        <defs>
          <linearGradient id="an-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2fb57a" stopOpacity=".9" />
            <stop offset="1" stopColor="#2fb57a" stopOpacity=".06" />
          </linearGradient>
        </defs>
        {grid}
        <path d={area} fill="url(#an-grad)" />
        <path className="ln" d={line} />
        {dots}
        {xlabels}
        <g visibility={hp ? "visible" : "hidden"}>
          <line className="hl" x1={hp?.[0]} x2={hp?.[0]} y1={pt} y2={pt + ih} />
          <circle className="hd" cx={hp?.[0]} cy={hp?.[1]} r="4.5" />
        </g>
        <rect
          x={pl}
          y="0"
          width={iw}
          height={H}
          fill="transparent"
          onPointerMove={fromEvent}
          onPointerLeave={() => {
            if (document.activeElement !== svgRef.current) setIdx(-1);
          }}
        />
      </svg>
      <div className="an-tip" ref={tipRef} hidden={cur < 0} style={{ left: tipX, top: hp?.[1] }}>
        {cd ? (
          <>
            <b>{cd.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</b>
            {fmtN(cd.views)} page views · {fmtN(cd.visits)} visits
          </>
        ) : null}
      </div>
    </div>
  );
}

export function AnalyticsView({ site, showToast }: { site: SiteLite & { name: string }; showToast: (text: string) => void }) {
  const [days, setDays] = useState<AnDay>(30);
  const [metric, setMetric] = useState<"views" | "visits">("views");
  const a = useMemo(() => anCompute(site, days), [site, days]);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["Date", "Page views", "Visits"],
      ...a.ser.map((d) => [d.date.toISOString().slice(0, 10), d.views, d.visits]),
    ];
    rows.push([], ["Total visits", a.visits], ["Unique visitors", a.unique]);
    if (a.shop) rows.push(["Store revenue (NGN)", a.revenue], ["Conversion rate (%)", a.conv]);
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const el = document.createElement("a");
    el.href = url;
    el.download = `${slugify(site.name) || "site"}-analytics-${days}d.csv`;
    document.body.appendChild(el);
    el.click();
    el.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Report exported (${TF_LABEL[days].toLowerCase()})`);
  };

  const kpi = (k: string, c: string, lbl: string, val: string, delta: number | null) => (
    <div className="ov-card an-kpi" key={lbl}>
      <span className="an-ki" style={{ "--kc": c } as CSSProperties}>{K_ICONS[k]}</span>
      <div className="t">
        <small>{lbl}</small>
        <div className="v">
          <strong>{val}</strong>
          {delta != null ? <span className="an-delta">↑ +{delta}%</span> : null}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="ov-head">
        <h1 tabIndex={-1}>Site &amp; Store Analytics</h1>
        <p>Track your visitor traffic, conversion rates, and revenue performance.</p>
      </div>

      <div className="an-bar">
        <MoreMenu
          ariaLabel="Timeframe"
          className="fmenu an-tf-menu"
          buttonClassName="an-tf"
          buttonContent={<>{CAL}<span>Timeframe</span><b>{TF_LABEL[days]}</b>{CHEV_D}</>}
          items={AN_DAYS.map((dd) => ({
            kind: "item" as const,
            label: TF_LABEL[dd],
            checked: dd === days,
            onSelect: () => setDays(dd),
          }))}
        />
        <button type="button" className="btn-dark an-export" onClick={exportCsv}>
          {DL}Export Report CSV
        </button>
      </div>

      <div className="an-kpis">
        {kpi("eye", "#4a5aa8", "Total Visits", fmtN(a.visits), a.dl[0])}
        {kpi("users", "#a07c3c", "Unique Visitors", fmtN(a.unique), a.dl[1])}
        {kpi("bars", "#2e9a54", "Store Revenue", a.shop ? "₦" + fmtN(a.revenue) : "—", a.shop ? a.dl[2] : null)}
        {kpi("conv", "#8a3fa8", "Conversion Rate", a.shop ? a.conv.toFixed(1) + "%" : "—", null)}
      </div>

      <section className="ov-card an-chart" aria-labelledby="an-ct">
        <header>
          <h2 id="an-ct">Traffic Overview <span>(Visitor Trend Chart)</span></h2>
          <MoreMenu
            ariaLabel="Chart options"
            className="row-menu fmenu"
            items={[
              { kind: "heading", label: "Plot" },
              { kind: "item", label: "Page views", checked: metric === "views", onSelect: () => setMetric("views") },
              { kind: "item", label: "Visits", checked: metric === "visits", onSelect: () => setMetric("visits") },
              { kind: "divider" },
              { kind: "item", label: "Download CSV", onSelect: exportCsv },
            ]}
          />
        </header>
        <TrafficChart series={a.ser} metric={metric} days={days} />
      </section>

      <div className="an-bottom">
        <section className="ov-card an-list" aria-labelledby="an-pt">
          <header><h2 id="an-pt">Top Performing Pages</h2></header>
          <ol>
            {a.pages.map((p, i) => (
              <li className="an-row" key={p.id}>
                <span className="n">{i + 1}.</span>
                <span className="an-pi" style={{ "--pc": PAGE_TINT[i] } as CSSProperties}>{wIcon(p.ic)}</span>
                <span className="nm">{p.name === "Home Page" ? "Homepage" : p.name} ('{p.path}')</span>
                <span className="ct">{fmtN(p.views)}</span>
                <span className="un">views</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="ov-card an-list" aria-labelledby="an-st">
          <header><h2 id="an-st">Top Selling Products</h2><span className="engine">{I_CHECK_C}Medusa</span></header>
          {a.sellers.length ? (
            <ol>
              {a.sellers.map((p, i) => (
                <li className="an-row" key={p.name}>
                  <span className="n">{i + 1}.</span>
                  <span className="pthumb" style={{ "--tb": p.tint } as CSSProperties} aria-hidden="true">
                    {p.emoji}
                    <img src={photoUrl(p.photo)} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} />
                  </span>
                  <span className="nm">{p.name}</span>
                  <span className="ct">{fmtN(p.sold)}</span>
                  <span className="un">Sold</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="an-empty">This site has no store yet, so there are no sales to show.</p>
          )}
        </section>
      </div>
    </>
  );
}

/* -------------------------------------------------- Site Settings + dialogs */

type SsTab = "domain" | "branding" | "pixels" | "danger";

const DNS_RECORDS = [
  { type: "A", host: "@", value: "76.76.21.21", title: "A Record - Root Domain" },
  { type: "CNAME", host: "www", value: "alias.digitalromanian.com", title: "CNAME Record - www Subdomain" },
];
const SS_SOON: Record<string, string> = {
  branding: "Upload your logo and favicon and set the colours visitors see on this site.",
  pixels: "Add Google Analytics, Meta Pixel and other tracking scripts to this site.",
  danger: "Unpublish, transfer or permanently delete this site.",
};

const I_GLOBE_24 = (
  <svg width="24" height="24" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.3" />
    <path d="M1.75 8h12.5M8 1.75c1.9 2 1.9 10.5 0 12.5M8 1.75c-1.9 2-1.9 10.5 0 12.5" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
const I_GLOBE_16 = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.3" />
    <path d="M1.75 8h12.5M8 1.75c1.9 2 1.9 10.5 0 12.5M8 1.75c-1.9 2-1.9 10.5 0 12.5" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
const SS_BRANDING = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.75a6.25 6.25 0 1 0 0 12.5c.9 0 1.3-.6 1.3-1.2 0-.8-.6-1-.6-1.8 0-.7.6-1.2 1.3-1.2h1.4A2.85 2.85 0 0 0 14.25 7.2 5.8 5.8 0 0 0 8 1.75Z" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="5" cy="7" r=".9" fill="currentColor" />
    <circle cx="7.5" cy="4.6" r=".9" fill="currentColor" />
    <circle cx="10.6" cy="5.4" r=".9" fill="currentColor" />
  </svg>
);
const SS_PIXELS = (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
    <path d="M4.51398 10.3701C4.3196 10.3701 4.16121 10.516 4.16121 10.6951V15.643H1.50462V10.7084C1.50462 10.5293 1.34623 10.3834 1.15184 10.3834C0.95746 10.3834 0.799072 10.5293 0.799072 10.7084V15.9747C0.799072 16.1537 0.95746 16.2997 1.15184 16.2997H4.51398C4.70837 16.2997 4.86676 16.1537 4.86676 15.9747V10.7017C4.86676 10.516 4.70837 10.3701 4.51398 10.3701Z" fill="currentColor" stroke="currentColor" strokeWidth="0.6" />
    <path d="M9.97846 9.11035C9.78408 9.11035 9.62569 9.25627 9.62569 9.43535V15.6435H6.9763V10.4103C6.9763 10.2313 6.81791 10.0853 6.62352 10.0853C6.42914 10.0853 6.27075 10.2313 6.27075 10.4103V15.9685C6.27075 16.1475 6.42914 16.2934 6.62352 16.2934H9.98566C10.18 16.2934 10.3384 16.1475 10.3384 15.9685V9.43535C10.3384 9.25627 10.18 9.11035 9.97846 9.11035Z" fill="currentColor" stroke="currentColor" strokeWidth="0.6" />
    <path d="M15.4571 6.10547C15.2627 6.10547 15.1043 6.25139 15.1043 6.43047V15.6431H12.4477V8.36055C12.4477 8.18147 12.2893 8.03555 12.095 8.03555C11.9006 8.03555 11.7422 8.18147 11.7422 8.36055V15.9681C11.7422 16.1472 11.9006 16.2931 12.095 16.2931H15.4571C15.6515 16.2931 15.8099 16.1472 15.8099 15.9681V6.4371C15.8099 6.25139 15.6515 6.10547 15.4571 6.10547Z" fill="currentColor" stroke="currentColor" strokeWidth="0.6" />
    <path d="M15.9971 0.607115C15.9899 0.487728 15.9107 0.388239 15.8027 0.335179C15.6875 0.282118 15.5507 0.28875 15.4499 0.355076L11.5766 2.72954C11.4686 2.79587 11.411 2.90862 11.4182 3.02138C11.4254 3.14076 11.5046 3.24025 11.6126 3.29331L13.3405 4.08259C11.5046 7.83664 5.52908 9.28918 0.69826 8.73867C0.503875 8.71214 0.323889 8.84479 0.302291 9.02387C0.280692 9.20295 0.417482 9.36877 0.611867 9.38867C1.32461 9.46826 2.05175 9.50805 2.7933 9.50805C7.42974 9.50805 12.2606 7.87643 13.9812 4.36779L15.7883 5.19687C15.8387 5.21677 15.8891 5.23003 15.9467 5.23003C16.0187 5.23003 16.0835 5.21013 16.1411 5.17697C16.249 5.11064 16.3066 4.99789 16.2994 4.88514L15.9971 0.607115ZM13.938 3.62494L12.4909 2.96168L15.3347 1.21731L15.5579 4.36116L13.938 3.62494Z" fill="currentColor" stroke="currentColor" strokeWidth="0.6" />
  </svg>
);
const SS_DANGER = (
  <svg width="18" height="16" viewBox="0 0 18 16" fill="none" aria-hidden="true">
    <path d="M0 16L9 0L18 16H0ZM2.29518 14.6286H15.7048L9 2.74286L2.29518 14.6286ZM9.50886 13.3239C9.64784 13.181 9.71733 13.0063 9.71733 12.8C9.71733 12.5937 9.64784 12.419 9.50886 12.2761C9.37002 12.133 9.2004 12.0615 9 12.0615C8.7996 12.0615 8.62998 12.133 8.49114 12.2761C8.35216 12.419 8.28267 12.5937 8.28267 12.8C8.28267 13.0063 8.35216 13.181 8.49114 13.3239C8.62998 13.467 8.7996 13.5385 9 13.5385C9.2004 13.5385 9.37002 13.467 9.50886 13.3239ZM8.33396 11.1472H9.66604V6.57577H8.33396V11.1472Z" fill="currentColor" />
  </svg>
);
const SS_TABS: [SsTab, string, ReactNode][] = [
  ["domain", "Custom Domain", I_GLOBE_16],
  ["branding", "Branding & Favicon", SS_BRANDING],
  ["pixels", "Analytics & Pixels", SS_PIXELS],
  ["danger", "Danger Zone", SS_DANGER],
];

const normDomain = (v: string) =>
  v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/^www\./, "").replace(/\.$/, "");
const DOMAIN_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

const COPY_IC = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="5.5" y="5.5" width="8" height="8.5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1h.5" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);
const REC_IC = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 5v5M5.5 7.5 8 10l2.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const I_OK_CIRCLE = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-label="Valid domain">
    <circle cx="8" cy="8" r="7" fill="#22a95b" />
    <path d="m5 8.2 2 2 4-4.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const I_INFO_18 = (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 7.2v4M8 4.9h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

function DomainDialog({
  prefill,
  currentDomain,
  onCancel,
  onVerify,
}: {
  prefill: string;
  currentDomain: string;
  onCancel: () => void;
  onVerify: (domain: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);
  const proceedRef = useRef(false);
  const [value, setValue] = useState(prefill.trim());
  const [error, setError] = useState("");

  const v = normDomain(value);
  const ok = DOMAIN_RE.test(v);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => {
      if (d.open) closingRef.current = true;
      d.close();
    };
  }, []);

  const handleClose = () => {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    if (proceedRef.current) {
      onVerify(normDomain(value));
      return;
    }
    onCancel();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let msg = "";
    if (!v) msg = "Enter the domain you own, e.g. mybusiness.com.";
    else if (!DOMAIN_RE.test(v)) msg = `“${value.trim()}” isn't a valid domain. Use something like mybusiness.com.`;
    else if (v === currentDomain) msg = `${v} is already connected to this site.`;
    else if (/(^|\.)digitalromanian\.(ro|com)$/.test(v)) msg = "Use a domain you own, not a Digital Romanian address.";
    setError(msg);
    if (msg) {
      inputRef.current?.focus();
      return;
    }
    proceedRef.current = true;
    ref.current?.close();
  };

  return (
    <dialog
      className="modal modal-domain"
      ref={ref}
      aria-labelledby="dm-title"
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <form className="dm-in" id="dm-form" noValidate onSubmit={submit}>
        <div className="dm-head">
          <span className="dm-ic">{I_GLOBE_24}</span>
          <div>
            <h2 id="dm-title">Connect Custom Domain</h2>
            <p>Enter your existing domain name (e.g; purchased from Namecheap, GoDaddy, or Google Domains).</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
            {icon("i-close", 18, 18, "0 0 16 16")}
          </button>
        </div>
        <label className="dm-label" htmlFor="dm-input">Domain Name:<span className="req" aria-hidden="true">*</span></label>
        <div className="dm-field">
          <input
            ref={inputRef}
            id="dm-input"
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            placeholder="e.g. mybusiness.com"
            aria-describedby="dm-err"
            value={value}
            aria-invalid={!!error}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
          />
          <span className="dm-ok" hidden={!ok}>{I_OK_CIRCLE}</span>
        </div>
        <p className="pf-err" id="dm-err" role="alert" hidden={!error}>{error}</p>
        <div className="dm-foot">
          <button type="button" className="btn-outline dm-btn" onClick={() => ref.current?.close()}>Cancel</button>
          <button type="submit" className="btn-primary dm-btn">Verify DNS {icon("i-arrow-right", 14, 14, "0 0 16 16")}</button>
        </div>
      </form>
    </dialog>
  );
}

type DnsPhase = "wait" | "check" | "bad" | "ok";

function DnsDialog({
  domain,
  onBack,
  onCancel,
  onConnected,
  onPending,
}: {
  domain: string;
  onBack: () => void;
  onCancel: () => void;
  onConnected: () => void;
  onPending: (domain: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const verifyRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);
  const actionRef = useRef<"back" | null>(null);
  const phaseRef = useRef<DnsPhase>("wait");
  const triesRef = useRef(0);
  const [phase, setPhase] = useState<DnsPhase>("wait");
  const [copied, setCopied] = useState<string | null>(null);
  phaseRef.current = phase;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    verifyRef.current?.focus();
    return () => {
      if (d.open) closingRef.current = true;
      d.close();
    };
  }, []);

  const handleClose = () => {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    if (actionRef.current === "back") {
      onBack();
      return;
    }
    /* Closing without verifying leaves the domain pending on the Custom Domain tab */
    if (phaseRef.current !== "ok") {
      onPending(domain);
      return;
    }
    onCancel();
  };

  const fallbackCopy = (text: string) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    ref.current?.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
      /* ignore */
    }
    ta.remove();
  };
  const copy = (text: string, key: string) => {
    const done = () => {
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1400);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  };

  const verify = () => {
    if (phaseRef.current === "ok") {
      ref.current?.close();
      return;
    }
    if (phaseRef.current === "check") return;
    setPhase("check");
    window.setTimeout(() => {
      if (!ref.current?.open) return;
      triesRef.current += 1;
      /* Prototype only: the first check finds the A record but not the CNAME yet, the second one succeeds. */
      if (triesRef.current < 2) {
        setPhase("bad");
        return;
      }
      onConnected();
      setPhase("ok");
    }, 1400);
  };

  const lines = DNS_RECORDS.map((r) => `Type: ${r.type} | Host: ${r.host} | Value: ${r.value}`).join("\n");
  const allText = `DNS records for ${domain}\n${lines}`;
  const fieldCopy = (value: string, label: string) => {
    const key = `f:${label}`;
    return (
      <button
        type="button"
        className={`dns-fc${copied === key ? " done" : ""}`}
        aria-label={`Copy ${label}`}
        title="Copy"
        onClick={() => copy(value, key)}
      >
        {copied === key ? TICK : COPY_IC}
      </button>
    );
  };

  const verifyLabel =
    phase === "check" ? (
      <>
        <span className="dm-spin" aria-hidden="true" />Checking DNS…
      </>
    ) : phase === "bad" ? (
      "Check Again"
    ) : phase === "ok" ? (
      "Done"
    ) : (
      "Verify Connection"
    );

  const sslText =
    phase === "ok"
      ? "SSL certificate is being issued. Your site will load over https:// within a few minutes."
      : "SSL certificate will be provisioned automatically once verified.";

  return (
    <dialog
      className="modal modal-domain"
      ref={ref}
      aria-labelledby="dns-title"
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className="dm-in">
        <div className="dm-head">
          <span className="dm-ic">{I_GLOBE_24}</span>
          <div>
            <h2 id="dns-title">DNS Verification &amp; Record Instructions</h2>
            <p>Add these records with your domain registrar (Namecheap, GoDaddy, etc.). Open your domain’s DNS settings there and copy each value below.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
            {icon("i-close", 18, 18, "0 0 16 16")}
          </button>
        </div>
        <div className="dns-box">
          <div className="dns-cfg">
            {I_INFO_18}
            <span>DNS Configuration for:</span><b>{domain}</b>
            <button type="button" className={`dns-copy${copied === "all" ? " done" : ""}`} onClick={() => copy(allText, "all")}>
              {copied === "all" ? <>{TICK}Copied</> : <>{COPY_IC}Copy All</>}
            </button>
          </div>
          <div>
            {DNS_RECORDS.map((r, i) => (
              <div className={`dns-rec${i ? " alt" : ""}`} key={r.type}>
                <p className="dns-rt">{REC_IC}Record {i + 1} ( {r.title} )</p>
                {i ? null : <hr />}
                <div className="dns-row">
                  <div className="dc">
                    <span>Type:</span>
                    <span className="dns-val"><b className={r.type === "A" ? "tp" : undefined}>{r.type}</b>{fieldCopy(r.type, `record ${i + 1} type`)}</span>
                  </div>
                  <i className="sep" />
                  <div className="dc">
                    <span>Host:</span>
                    <span className="dns-val"><b>{r.host}</b>{fieldCopy(r.host, `record ${i + 1} host`)}</span>
                  </div>
                  <i className="sep" />
                  <div className="dc v">
                    <span>Value:</span>
                    <span className="dns-val"><b>{r.value}</b>{fieldCopy(r.value, `record ${i + 1} value`)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <section className={`dns-st${phase === "bad" ? " bad" : phase === "ok" ? " ok" : ""}`} aria-labelledby="dns-st-h">
          <h3 id="dns-st-h">Connection Status</h3>
          <div role="status" aria-live="polite">
            {phase === "wait" ? (
              <p className="dns-st-line"><span className="dns-dot" aria-hidden="true" />Waiting for DNS propagation… <span className="sub">(Checking live)</span></p>
            ) : phase === "check" ? (
              <p className="dns-st-line"><span className="dm-spin" aria-hidden="true" />Looking up the records for {domain}…</p>
            ) : phase === "bad" ? (
              <>
                <p className="dns-st-line"><span className="dns-dot bad" aria-hidden="true" />Records not found yet</p>
                <ul className="dns-st-list">
                  {DNS_RECORDS.map((r, i) => {
                    const ok = i === 0;
                    return (
                      <li key={r.type} className={ok ? "ok" : "bad"}>
                        {ok ? TICK : (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M12 4 4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                        )}
                        {r.type} record ({r.host}) {ok ? "found" : "not found"}
                      </li>
                    );
                  })}
                </ul>
                <p className="dns-st-note">DNS changes can take a few minutes, and sometimes up to 48 hours, to spread. Check the missing record at your registrar, then try again.</p>
              </>
            ) : (
              <>
                <p className="dns-st-line"><span className="dns-dot ok" aria-hidden="true" />Connected · {domain} is live</p>
                <ul className="dns-st-list">
                  {DNS_RECORDS.map((r) => (
                    <li key={r.type} className="ok">{TICK}{r.type} record ({r.host}) verified</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <p className="dns-st-note">{sslText}</p>
        </section>
        <div className="dm-foot">
          <button
            type="button"
            className="btn-outline dm-btn"
            id="dns-back"
            hidden={phase === "ok"}
            onClick={() => {
              actionRef.current = "back";
              ref.current?.close();
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ transform: "scaleX(-1)" }}>
              <use href="#i-arrow-right" />
            </svg>
            Back
          </button>
          <button ref={verifyRef} type="button" className="btn-primary dm-btn wide" disabled={phase === "check"} onClick={verify}>
            {verifyLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* -------------------------------------------------- Branding & Favicon panel */

const META_T = 60;
const META_D = 300;

export type Branding = { siteName: string; favicon: string | null; metaTitle: string; metaDesc: string };
export type Pixels = { ga: string; fb: string; code: string; extra: string[]; vals: Record<string, string>; on: Record<string, boolean>; saved: number | null };


/* brandingOf(s) / pixelsOf(s) — seeded defaults from the prototype. */
export function generateBranding(site: SiteLite & { name: string }): Branding {
  const shop = isShopSite(site);
  return {
    siteName: site.name,
    favicon: shop ? photoUrl("1635450370155-d6a650322fa5") : null,
    metaTitle: shop ? `${site.name} | Sustainable Poultry & Produce` : `${site.name} | Official Website`,
    metaDesc: shop ? "Premium farm-raised broilers, feeds, and fresh produce." : "",
  };
}
export function generatePixels(site: SiteLite): Pixels {
  const fb = isShopSite(site) ? "123456789012345" : "";
  return {
    ga: "",
    fb,
    code: "",
    extra: ["ga", "fb"],
    vals: { ga: "", fb, code: "" },
    on: { ga: true, fb: true, code: true },
    saved: fb ? Date.now() - 6 * 864e5 : null,
  };
}

const I_IMG_UP = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="m4 17 4.5-4.5 3.5 3.5 2-2 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <circle cx="9" cy="9" r="1.4" fill="currentColor" />
    <path d="M18 3v6M15 6h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const I_GA = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="14" width="4" height="7" rx="1" fill="currentColor" />
    <rect x="10" y="9" width="4" height="12" rx="1" fill="currentColor" />
    <rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor" />
  </svg>
);
const I_FB = (
  <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
    <use href="#i-facebook" />
  </svg>
);
const I_CODE = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M5.5 4 1.5 8l4 4M10.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const I_SAVE = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 2.5h8l2.5 2.5v8.5H3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M5.5 2.5v3h5v-3M5.5 13.5V9.5h5v4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

function BrandingPanel({
  site,
  branding,
  onSave,
  showToast,
}: {
  site: SiteLite & { name: string };
  branding: Branding;
  onSave: (updater: (b: Branding) => Branding) => void;
  showToast: (text: string) => void;
}) {
  const [name, setName] = useState(branding.siteName);
  const [fav, setFav] = useState<string | null>(branding.favicon);
  const [title, setTitle] = useState(branding.metaTitle);
  const [desc, setDesc] = useState(branding.metaDesc);
  const [nameErr, setNameErr] = useState(false);
  const [favErr, setFavErr] = useState("");
  const [broken, setBroken] = useState(false);
  const [drag, setDrag] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const initial = initials(name || site.name).slice(0, 1) || "?";

  const take = (file?: File) => {
    if (!file) return;
    const okType =
      /^image\/(png|jpeg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon)$/.test(file.type) ||
      /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(file.name);
    if (!okType) {
      setFavErr("Use a PNG, JPG, WebP, SVG or ICO image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFavErr("That image is over 5MB. Pick a smaller one.");
      return;
    }
    setFavErr("");
    const keepAsIs =
      /svg/i.test(file.type) || /\.svg$/i.test(file.name) || /icon/i.test(file.type) || /\.ico$/i.test(file.name);
    const fail = () => setFavErr("That image couldn't be opened. Try another file.");
    const r = new FileReader();
    r.onerror = fail;
    r.onload = () => {
      const src = String(r.result);
      if (keepAsIs) {
        setFav(src);
        setBroken(false);
        return;
      }
      /* Raster: crop a centred square and downscale to at most 512px, as PNG. */
      const img = new Image();
      img.onerror = fail;
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const side = Math.min(w, h);
        if (side < 32) {
          setFavErr("That image is too small. Use one that is at least 32 × 32px.");
          return;
        }
        const target = Math.min(side, 512);
        const canvas = document.createElement("canvas");
        canvas.width = target;
        canvas.height = target;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          fail();
          return;
        }
        ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, target, target);
        setFav(canvas.toDataURL("image/png"));
        setBroken(false);
        if (w !== h) showToast("Your image wasn't square, so it was cropped to the centre.");
        else if (side < 512) showToast("Favicon added. A 512 × 512px image will look sharper on phones.");
      };
      img.src = src;
    };
    r.readAsDataURL(file);
  };

  const save = () => {
    const n = name.trim();
    if (!n) {
      setNameErr(true);
      nameRef.current?.focus();
      return;
    }
    const nextTitle = title.trim() || n;
    onSave((b) => ({ ...b, siteName: n, favicon: fav, metaTitle: nextTitle, metaDesc: desc.trim() }));
    setTitle(nextTitle);
    showToast(nextTitle.length > META_T ? `Branding saved. Your meta title is over ${META_T} characters, so Google may shorten it.` : "Branding changes saved");
  };

  return (
    <>
      <h2 className="ss-h br-h">Branding &amp; Global Metadata</h2>
      <div className="br-row">
        <label htmlFor="br-name">Site Name:</label>
        <input
          ref={nameRef}
          className="br-input"
          id="br-name"
          maxLength={80}
          autoComplete="off"
          value={name}
          aria-invalid={nameErr || undefined}
          aria-describedby="br-name-err"
          onChange={(e) => {
            setName(e.target.value);
            setNameErr(false);
          }}
        />
        <p className="br-err" id="br-name-err" hidden={!nameErr}>Give your site a name. It shows in browser tabs and search results.</p>
      </div>
      <div className="br-row">
        <span className="br-lbl" id="br-fav-lbl">Favicon Upload</span>
        <div className="br-fav">
          <label
            className={`br-drop${drag ? " drag" : ""}`}
            id="br-drop"
            onDragEnter={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              take(e.dataTransfer.files[0]);
            }}
          >
            {I_IMG_UP}
            <small>PNG, JPG,<br />SVG or ICO</small>
            <input
              type="file"
              id="br-file"
              accept=".ico,.svg,image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
              aria-labelledby="br-fav-lbl"
              onChange={(e) => {
                take(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <span className="br-prev" id="br-prev" aria-label="Favicon preview" role="img">
            {fav && !broken ? <img src={fav} alt="" onError={() => setBroken(true)} /> : initial}
          </span>
          <button
            type="button"
            className="btn-text"
            id="br-fav-rm"
            hidden={!fav}
            onClick={() => {
              setFav(null);
              setFavErr("");
              setBroken(false);
            }}
          >
            Remove
          </button>
        </div>
        <p className="br-err" id="br-fav-err" role="alert" hidden={!favErr}>{favErr}</p>
      </div>
      <h3 className="br-sec">
        Global Site Default SEO <small>(Fallback for pages without custom SEO)</small>
      </h3>
      <div className="br-row">
        <label htmlFor="br-title">Default Meta Title:</label>
        <div className="br-field">
          <input
            className="br-input has-pill"
            id="br-title"
            autoComplete="off"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <span
            className={`br-pill${title.length > META_T ? " over" : ""}`}
            id="br-title-pill"
            title={title.length > META_T ? `Google usually cuts titles after about ${META_T} characters` : undefined}
          >
            {title.length} chars
          </span>
        </div>
      </div>
      <div className="br-row top">
        <label htmlFor="br-desc">Default Meta Description:</label>
        <div className="br-field">
          <textarea
            className="br-input"
            id="br-desc"
            maxLength={META_D}
            placeholder="A short line that describes the site in search results"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <p className="br-count" id="br-desc-count" aria-live="polite">{desc.length}/{META_D}</p>
        </div>
      </div>
      <div className="br-foot">
        <button type="button" className="btn-dark" id="br-save" onClick={save}>Save Branding Changes</button>
      </div>
    </>
  );
}

/* -------------------------------------------------- Analytics & Pixels panel */

const pxUpAZ = (v: string) => v.toUpperCase().replace(/[^A-Z0-9-]/g, "");
const pxDigits = (v: string) => v.replace(/\D/g, "");
const pxLowAZ = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

type PxTool = {
  k: string;
  name: string;
  g: string;
  desc: string;
  label: string;
  ph: string;
  mode: "text" | "numeric";
  help?: string;
  icon?: ReactNode;
  mark?: string;
  c?: string;
  tc?: string;
  re: RegExp;
  msg: string;
  clean: (v: string) => string;
};

/* Tools a site owner can add from "Add tracking tool". Each one only needs an ID; the platform writes the code. */
const PX_TOOLS: PxTool[] = [
  { k: "ga", name: "Google Analytics", icon: I_GA, g: "Analytics", desc: "See visitors, traffic sources and top pages.", label: "Measurement ID", ph: "G-XXXXXXXXXX", mode: "text", help: "", re: /^G-[A-Z0-9]{6,12}$/, msg: "A Measurement ID looks like G-XXXXXXXXXX (G, a dash, then letters and numbers).", clean: pxUpAZ },
  { k: "fb", name: "Facebook / Meta Pixel", icon: I_FB, g: "Ad pixels", desc: "Measure results from Facebook and Instagram ads.", label: "Pixel ID", ph: "123456789012345", mode: "numeric", help: "", re: /^\d{15,16}$/, msg: "A Pixel ID is 15 or 16 digits, numbers only.", clean: pxDigits },
  { k: "tt", name: "TikTok Pixel", mark: "TT", c: "#161616", g: "Ad pixels", desc: "Measure sales and sign-ups from TikTok ads.", label: "Pixel ID", ph: "CABCD1234EFGH5678IJK", mode: "text", help: "Find it in TikTok Ads Manager → Tools → Events → Web events.", re: /^[A-Z0-9]{20}$/, msg: "A TikTok Pixel ID is 20 letters and numbers.", clean: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "") },
  { k: "gads", name: "Google Ads", mark: "Ads", c: "#1a73e8", g: "Ad pixels", desc: "Track conversions from Google ad campaigns.", label: "Conversion ID", ph: "AW-123456789", mode: "text", help: "Find it in Google Ads → Goals → Conversions → your conversion → Tag setup.", re: /^AW-\d{9,11}$/, msg: "A Conversion ID looks like AW-123456789 (AW, a dash, then 9–11 digits).", clean: pxUpAZ },
  { k: "snap", name: "Snapchat Pixel", mark: "SC", c: "#fffc00", tc: "#000", g: "Ad pixels", desc: "Measure results from Snapchat ads.", label: "Pixel ID", ph: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", mode: "text", help: "Find it in Snapchat Ads Manager → Events Manager → your pixel.", re: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, msg: "A Snapchat Pixel ID looks like a1b2c3d4-e5f6-7890-abcd-ef1234567890.", clean: (v) => v.toLowerCase().replace(/[^a-f0-9-]/g, "") },
  { k: "pin", name: "Pinterest Tag", mark: "Pi", c: "#c8102e", g: "Ad pixels", desc: "Track checkouts and sign-ups from Pinterest ads.", label: "Tag ID", ph: "2612345678901", mode: "numeric", help: "Find it in Pinterest Ads → Conversions → Tag manager.", re: /^\d{13}$/, msg: "A Pinterest Tag ID is 13 digits, numbers only.", clean: pxDigits },
  { k: "li", name: "LinkedIn Insight Tag", mark: "in", c: "#0a66c2", g: "Ad pixels", desc: "Measure LinkedIn ads and see who visits.", label: "Partner ID", ph: "1234567", mode: "numeric", help: "Find it in LinkedIn Campaign Manager → Analyze → Insight Tag.", re: /^\d{5,8}$/, msg: "A LinkedIn Partner ID is 5 to 8 digits.", clean: pxDigits },
  { k: "xp", name: "X (Twitter) Pixel", mark: "X", c: "#161616", g: "Ad pixels", desc: "Measure results from X ads.", label: "Pixel ID", ph: "o1abc", mode: "text", help: "Find it in X Ads Manager → Tools → Events manager.", re: /^[a-z0-9]{5,6}$/, msg: "An X Pixel ID is 5 or 6 letters and numbers, e.g. o1abc.", clean: pxLowAZ },
  { k: "gtm", name: "Google Tag Manager", mark: "GTM", c: "#2a6fdb", g: "Tag managers", desc: "Manage all your tags from one Google container.", label: "Container ID", ph: "GTM-XXXXXXX", mode: "text", help: "Find it at the top of your Google Tag Manager workspace.", re: /^GTM-[A-Z0-9]{4,9}$/, msg: "A Container ID looks like GTM-XXXXXXX.", clean: pxUpAZ },
  { k: "clarity", name: "Microsoft Clarity", mark: "MC", c: "#5c2d91", g: "Heatmaps & recordings", desc: "Free heatmaps and session recordings.", label: "Project ID", ph: "abcd1234ef", mode: "text", help: "Find it in Clarity → Settings → Overview.", re: /^[a-z0-9]{8,12}$/, msg: "A Clarity Project ID is 8 to 12 letters and numbers.", clean: pxLowAZ },
  { k: "hj", name: "Hotjar", mark: "HJ", c: "#e8452c", g: "Heatmaps & recordings", desc: "Heatmaps, recordings and feedback polls.", label: "Site ID", ph: "1234567", mode: "numeric", help: "Find it in Hotjar → Sites & Organizations.", re: /^\d{6,8}$/, msg: "A Hotjar Site ID is 6 to 8 digits.", clean: pxDigits },
  { k: "gsc", name: "Google Search Console", mark: "GSC", c: "#188038", g: "Search & verification", desc: "Verify your site and see how it shows on Google.", label: "Verification code", ph: "aBcD1234efGH5678", mode: "text", help: 'In Search Console pick "HTML tag" verification. Paste the whole tag or just the code inside content="…".', re: /^[A-Za-z0-9_-]{20,64}$/, msg: 'Paste the code from the HTML tag, the part inside content="…".', clean: (v) => { const m = v.match(/content=["']([^"']+)["']/i); return (m ? m[1] : v).replace(/[^A-Za-z0-9_-]/g, ""); } },
];
const PX_X: Record<string, PxTool> = Object.fromEntries(PX_TOOLS.map((t) => [t.k, t]));

/* Custom Header Code Injection is built but switched off for now. Set to true to bring it back. */
const PX_CODE_ON_FLAG = false;

const codeSnippet = (c: string) => {
  const line = (c || "").split("\n").map((x) => x.trim()).find(Boolean);
  return line || "No custom code yet";
};

const pxChip = (val: string, on: boolean) =>
  !val ? "Not set up" : on ? "Active" : "Paused";
const pxChipCls = (val: string, on: boolean) =>
  !val ? "px-chip" : on ? "px-chip on" : "px-chip off";

const I_PLUS_SM = (
  <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const I_PLUS_15 = (
  <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const I_TRASH = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 8.6c.05.5.45.9.95.9h4.7c.5 0 .9-.4.95-.9L12 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function PxMark({ t }: { t: PxTool }) {
  if (t.icon) return <span className="px-mark ic" aria-hidden="true">{t.icon}</span>;
  return (
    <span
      className={`px-mark${(t.mark || "").length > 2 ? " sm" : ""}`}
      style={{ ["--mk" as string]: t.c, ["--mt" as string]: t.tc || "#fff" }}
      aria-hidden="true"
    >
      {t.mark}
    </span>
  );
}

function PxAddDialog({
  open,
  extra,
  onClose,
  onAdd,
}: {
  open: boolean;
  extra: string[];
  onClose: () => void;
  onAdd: (k: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);
  const qRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    const d = ref.current;
    if (!d || !open) return;
    setQ("");
    if (!d.open) d.showModal();
    window.setTimeout(() => qRef.current?.focus(), 0);
    return () => {
      if (d.open) closingRef.current = true;
      d.close();
    };
  }, [open]);
  const handleClose = () => {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    onClose();
  };
  const query = q.trim().toLowerCase();
  const groups = Array.from(new Set(PX_TOOLS.map((t) => t.g)))
    .map((g) => ({ g, items: PX_TOOLS.filter((t) => t.g === g && (!query || `${t.name} ${t.desc} ${t.g}`.toLowerCase().includes(query))) }))
    .filter((x) => x.items.length > 0);
  const hits = groups.reduce((n, x) => n + x.items.length, 0);
  return (
    <dialog
      className="modal modal-domain modal-pxadd"
      ref={ref}
      aria-labelledby="pxa-title"
      aria-describedby="pxa-sub"
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      hidden={!open}
    >
      <div className="dm-in pxa-in">
        <div className="dm-head">
          <span className="dm-ic">{I_GA}</span>
          <div>
            <h2 id="pxa-title">Add a tracking tool</h2>
            <p id="pxa-sub">Pick the tool you use. You&apos;ll only need its ID, and we add the tracking code to every page for you.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
            {icon("i-close", 18, 18, "0 0 16 16")}
          </button>
        </div>
        <div className="pxa-search">
          {icon("i-search", 16, 16, "0 0 16 16")}
          <label className="sr-only" htmlFor="pxa-q">Search tracking tools</label>
          <input
            id="pxa-q"
            ref={qRef}
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search tools, e.g. TikTok"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="pxa-list" aria-live="polite">
          {hits ? (
            groups.map(({ g, items }) => (
              <Fragment key={g}>
                <p className="pxa-g">{g}</p>
                <ul>
                  {items.map((t) => {
                    const added = extra.includes(t.k);
                    return (
                      <li key={t.k}>
                        <button
                          type="button"
                          className="pxa-item"
                          disabled={added}
                          onClick={() => {
                            if (added) return;
                            ref.current?.close();
                            onAdd(t.k);
                          }}
                        >
                          <PxMark t={t} />
                          <span className="t">
                            <b>{t.name}</b>
                            <small>{t.desc}</small>
                          </span>
                          <span className="st">{added ? <>{TICK}Added</> : <>{I_PLUS_SM}Add</>}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Fragment>
            ))
          ) : (
            <p className="pxa-empty">“{q.trim()}” isn&apos;t in the list yet.</p>
          )}
        </div>
        <button
          type="button"
          className="pxa-other"
          hidden={!PX_CODE_ON_FLAG}
          onClick={() => {
            ref.current?.close();
            onAdd("code");
          }}
        >
          <span className="px-ic code">{I_CODE}</span>
          <span className="t">
            <b>Other tool</b>
            <small>Not listed? Paste the tool&apos;s code into Custom Header Code Injection.</small>
          </span>
          <span className="st">Paste code</span>
        </button>
        <div className="dm-foot pxa-foot">
          <button type="button" className="btn-outline dm-btn" onClick={() => ref.current?.close()}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  );
}

type PxDraft = { extra: string[]; vals: Record<string, string>; on: Record<string, boolean> };

const pxDraftOf = (p: Pixels): PxDraft => {
  const extra = [...(p.extra && p.extra.length ? p.extra : ["ga", "fb"])];
  const vals: Record<string, string> = {};
  const on: Record<string, boolean> = {};
  [...extra, "code"].forEach((k) => {
    if (p.vals && p.vals[k] !== undefined) vals[k] = p.vals[k];
    else if (k === "ga") vals[k] = p.ga || "";
    else if (k === "fb") vals[k] = p.fb || "";
    else if (k === "code") vals[k] = p.code || "";
    else vals[k] = "";
    on[k] = p.on && p.on[k] !== undefined ? p.on[k] : true;
  });
  return { extra, vals, on };
};

function PixelsPanel({
  site,
  pixels,
  onSave,
  showToast,
}: {
  site: SiteLite & { name: string };
  pixels: Pixels;
  onSave: (updater: (p: Pixels) => Pixels) => void;
  showToast: (text: string) => void;
}) {
  const [add, setAdd] = useState(false);
  const [draft, setDraft] = useState<PxDraft>(() => pxDraftOf(pixels));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const codeRef = useRef<HTMLTextAreaElement>(null);

  /* Unsaved edits survive re-renders (adding/removing a tool) but are dropped
     when the panel opens fresh. */
  useEffect(() => {
    setDraft(pxDraftOf(pixels));
    setErrs({});
  }, [pixels]);

  const savedDraft = useMemo(() => JSON.stringify(pxDraftOf(pixels)), [pixels]);
  const dirty = JSON.stringify(draft) !== savedDraft;
  const code = draft.vals.code || "";
  const hasValue = [...draft.extra, "code"].some((k) => (draft.vals[k] || "").trim());
  const note = dirty
    ? "You have unsaved changes."
    : !hasValue
      ? PX_CODE_ON_FLAG
        ? "No tracking yet. Add an ID or a script above, then save."
        : "No tracking yet. Add a tracking tool above, then save."
      : pixels.saved
        ? `All changes saved · ${timeAgo(pixels.saved).toLowerCase()}.`
        : "All changes saved.";

  const copy = (text: string, key: string) => {
    const done = () => {
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    };
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* noop */
      }
      done();
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  };

  const focusRow = (k: string) => {
    window.setTimeout(() => {
      const el = document.getElementById(`px-${k}`) as HTMLInputElement | null;
      el?.closest(".px-row")?.scrollIntoView({ block: "nearest" });
      el?.focus();
    }, 0);
  };

  const save = () => {
    const next: Record<string, string> = {};
    let first: string | null = null;
    draft.extra.forEach((k) => {
      const t = PX_X[k];
      const v = (draft.vals[k] || "").trim();
      if (t && v && !t.re.test(v)) {
        next[k] = t.msg;
        first = first ?? k;
      }
    });
    setErrs(next);
    if (first) {
      focusRow(first);
      return;
    }
    const c = code.trim();
    if (PX_CODE_ON_FLAG && /<script\b/i.test(c) && !/<\/script>/i.test(c)) {
      setCodeOpen(true);
      showToast("Your custom code has an opening <script> tag with no closing </script>.");
      return;
    }
    onSave((p) => ({
      ...p,
      ga: draft.vals.ga || "",
      fb: draft.vals.fb || "",
      code: c,
      extra: [...draft.extra],
      vals: { ...draft.vals },
      on: { ...draft.on },
      saved: Date.now(),
    }));
    const n = [...draft.extra, "code"].filter((k) => draft.on[k] && (draft.vals[k] || "").trim()).length;
    showToast(
      n
        ? `Tracking saved. ${n} ${n === 1 ? "tool is" : "tools are"} active on ${site.name}.`
        : "Tracking saved. No tracking tools are active.",
    );
  };

  const discard = () => {
    setDraft(pxDraftOf(pixels));
    setErrs({});
    showToast("Changes discarded");
  };

  const remove = (t: PxTool) => {
    setDraft((d) => {
      const extra = d.extra.filter((x) => x !== t.k);
      const vals = { ...d.vals };
      delete vals[t.k];
      const on = { ...d.on };
      delete on[t.k];
      return { extra, vals, on };
    });
    setErrs((s) => ({ ...s, [t.k]: "" }));
    showToast(`${t.name} removed. Save to apply.`);
  };

  const addTool = (k: string) => {
    if (k === "code") {
      setCodeOpen(true);
      focusRow("code");
      return;
    }
    setDraft((d) =>
      d.extra.includes(k)
        ? d
        : { extra: [...d.extra, k], vals: { ...d.vals, [k]: "" }, on: { ...d.on, [k]: true } },
    );
    focusRow(k);
  };

  const setVal = (k: string, value: string) => {
    setDraft((d) => ({ ...d, vals: { ...d.vals, [k]: value } }));
    setErrs((s) => ({ ...s, [k]: "" }));
  };

  return (
    <>
      <h2 className="ss-h br-h">Analytics &amp; Pixels</h2>
      <p className="px-sub">
        Connect your tracking tools and add custom scripts to monitor your site&apos;s performance and behaviour.
        Tracking only runs on the published site, not in previews.
      </p>
      <div className="px-list">
        {draft.extra.map((k, i) => {
          const t = PX_X[k];
          if (!t) return null;
          const val = draft.vals[k] || "";
          const isOn = draft.on[k] !== false;
          const err = errs[k];
          return (
            <div className={`px-row${i % 2 ? "" : " tint"}`} key={k}>
              <span className="px-ic">
                <PxMark t={t} />
              </span>
              <div>
                <span className="px-head">
                  <strong>{t.name}</strong>
                  <span id={`px-${k}-chip`} className={pxChipCls(val, isOn && !!val)}>
                    {pxChip(val, isOn && !!val)}
                  </span>
                </span>
                <span className="px-id">
                  <label htmlFor={`px-${k}`}>{t.label}</label>
                  <input
                    className="px-in"
                    id={`px-${k}`}
                    inputMode={t.mode}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={`e.g. ${t.ph}`}
                    value={val}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={`px-${k}-err`}
                    onChange={(e) => setVal(k, t.clean(e.target.value))}
                  />
                </span>
                <p className="px-err" id={`px-${k}-err`} hidden={!err}>
                  {err}
                </p>
              </div>
              <div className="px-acts">
                <label className="px-switch" hidden={!val}>
                  <input
                    type="checkbox"
                    role="switch"
                    disabled={!val}
                    checked={isOn}
                    aria-label={`Load ${t.name} on this site`}
                    onChange={(e) => setDraft((d) => ({ ...d, on: { ...d.on, [k]: e.target.checked } }))}
                  />
                  On
                </label>
                <button
                  type="button"
                  className={`px-copy${copied === k ? " done" : ""}`}
                  hidden={!val}
                  onClick={() => val.trim() && copy(val.trim(), k)}
                >
                  {copied === k ? (
                    <>
                      {TICK}Copied
                    </>
                  ) : (
                    <>
                      {COPY_IC}Copy ID
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="px-remove"
                  aria-label={`Remove ${t.name}`}
                  title={`Remove ${t.name}`}
                  onClick={() => remove(t)}
                >
                  {I_TRASH}
                </button>
              </div>
            </div>
          );
        })}
        <div className="px-row px-addrow">
          <span className="px-ic">
            <span className="px-plus">{I_PLUS_15}</span>
          </span>
          <div className="px-addbox">
            <button type="button" className="px-add" id="px-add" aria-haspopup="dialog" onClick={() => setAdd(true)}>
              {I_PLUS_15}Add tracking tool
            </button>
          </div>
        </div>
        {PX_CODE_ON_FLAG && (
          <div className="px-row tint px-coderow">
            <span className="px-ic code">{I_CODE}</span>
            <div>
              <span className="px-head">
                <strong>Custom Header Code Injection</strong>
                <span className={pxChipCls(code, draft.on.code !== false)}>{pxChip(code, draft.on.code !== false)}</span>
              </span>
              <span className="px-snip">
                <code>{codeSnippet(code)}</code>
                <button
                  type="button"
                  className="btn-text"
                  aria-expanded={codeOpen}
                  onClick={() => setCodeOpen((v) => !v)}
                >
                  {codeOpen ? "Close editor" : code.trim() ? "Edit code" : "Add script"}
                </button>
              </span>
            </div>
            <div className="px-acts">
              <label className="px-switch" hidden={!code}>
                <input
                  type="checkbox"
                  role="switch"
                  disabled={!code}
                  checked={draft.on.code !== false}
                  aria-label="Load custom code on this site"
                  onChange={(e) => setDraft((d) => ({ ...d, on: { ...d.on, code: e.target.checked } }))}
                />
                On
              </label>
            </div>
            {codeOpen && (
              <textarea
                ref={codeRef}
                className="px-code"
                spellCheck={false}
                placeholder={"<!-- Paste scripts here. They load in the <head> of every page. -->"}
                value={code}
                onChange={(e) => setVal("code", e.target.value)}
              />
            )}
          </div>
        )}
        <div className="px-bar">
          <p className={`note${dirty ? " dirty" : ""}`} aria-live="polite">
            {note}
          </p>
          <div className="row">
            <button type="button" className="btn-light" hidden={!dirty} onClick={discard}>
              Discard
            </button>
            <button type="button" className="btn-dark px-save" disabled={!dirty} onClick={save}>
              {I_SAVE}Save Tracking Configuration
            </button>
          </div>
        </div>
      </div>
      <PxAddDialog open={add} extra={draft.extra} onClose={() => setAdd(false)} onAdd={addTool} />
    </>
  );
}

/* -------------------------------------------------- Danger Zone */

function DangerPanel({
  status,
  live,
  workspaceName,
  otherWorkspaces,
  counts,
  onUnpublish,
  onTransfer,
  onDelete,
  onCreateWorkspace,
}: {
  status: "ready" | "setup" | "frozen" | "disabled";
  live: boolean;
  workspaceName: string;
  otherWorkspaces: Array<{ id: string; name: string; sites: number; members: number }>;
  counts: { pages: number; articles: number; products: number; orders: number };
  onUnpublish: () => void;
  onTransfer: (toId: string) => void;
  onDelete: () => void;
  onCreateWorkspace: () => void;
}) {
  const [show, setShow] = useState<null | "unpub" | "trans" | "del">(null);
  const canDel = !live && status !== "ready" && status !== "setup";
  return (
    <>
      <h2 className="ss-h br-h">Danger Zone</h2>
      <p className="px-sub">Take irreversible actions. Unpublishing hides your site while keeping content. Deleting removes this site and its reference across workspaces.</p>
      <div className="sdz">
        <article className="sdz-card">
          <header className="sdz-h">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5 1.3 13.5h13.4L8 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M8 6v3.5M8 11.5h0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>Unpublish Site</span>
          </header>
          <p>Take this site offline. All published pages, blog posts and the live URL will stop working. You can republish later.</p>
          <ul className="sdz-list">
            <li><b>Effect:</b> {live ? "Site becomes unpublished (hidden)" : "Already unpublished"}</li>
            <li><b>Scope:</b> Content, pages and SEO remain in this workspace</li>
          </ul>
          <div className="sdz-act">
            <button type="button" className="btn-outline sdz-btn" disabled={!live} onClick={() => setShow("unpub")}>
              Unpublish Site
            </button>
          </div>
        </article>
        <article className="sdz-card">
          <header className="sdz-h">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 8v6h12V8M1.5 5h13V8h-13z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M8 5V2.5M6 4h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span>Transfer Ownership</span>
          </header>
          <p>Move this site to another workspace you own or manage. The site’s content stays intact.</p>
          <ul className="sdz-list">
            <li><b>From:</b> {workspaceName}</li>
            <li><b>To:</b> Choose a workspace below</li>
          </ul>
          <div className="sdz-act col">
            {otherWorkspaces.length ? (
              otherWorkspaces.map((w) => (
                <button key={w.id} type="button" className="btn-outline sdz-btn block" onClick={() => setShow({ t: "trans", toId: w.id, toName: w.name } as any)}>
                  Transfer to <b>{w.name}</b> <small>({w.sites} sites · {w.members} members)</small>
                </button>
              ))
            ) : (
              <button type="button" className="btn-outline sdz-btn block" onClick={onCreateWorkspace}>
                Create new workspace
              </button>
            )}
          </div>
        </article>
        <article className="sdz-card bad">
          <header className="sdz-h">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2.5 3.5h11M6 3.5V2.5h4v1M3.5 5v8a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6.5 7.5v4M9.5 7.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span>Delete Site</span>
          </header>
          <p>This will permanently remove this site from the system. This action cannot be undone.</p>
          <ul className="sdz-list">
            <li><b>Counts:</b> {counts.pages} pages, {counts.articles} articles, {counts.products} products, {counts.orders} orders</li>
            <li><b>Requires:</b> Site unpublished and status not &quot;Ready&quot;/&quot;Setup&quot;</li>
          </ul>
          <div className="sdz-act">
            <button type="button" className="btn-outline sdz-btn bad" disabled={!canDel} onClick={() => setShow("del")} title={canDel ? undefined : "Unpublish and ensure status allows deletion."}>
              Delete Permanently
            </button>
          </div>
        </article>
      </div>
      <SiteDangerDialog
        kind={show === "unpub" ? "unpub" : show === "del" ? "del" : (show as any)?.t === "trans" ? "trans" : null}
        toName={(show as any)?.toName}
        onCancel={() => setShow(null)}
        onConfirm={() => {
          if (show === "unpub") onUnpublish();
          if ((show as any)?.t === "trans") onTransfer((show as any).toId);
          if (show === "del") onDelete();
          setShow(null);
        }}
      />
    </>
  );
}

function SiteDangerDialog({
  kind,
  toName,
  onCancel,
  onConfirm,
}: {
  kind: "unpub" | "del" | "trans" | null;
  toName?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!kind) return;
    if (!d.open) d.showModal();
    return () => {
      if (d.open) closingRef.current = true;
      d.close();
    };
  }, [kind]);
  const handleClose = () => {
    if (closingRef.current) {
      closingRef.current = false;
      return;
    }
    onCancel();
  };
  if (!kind) return null;
  const t =
    kind === "unpub" ? { title: "Unpublish Site", body: "Are you sure you want to unpublish this site? It will go offline for everyone.", ok: "Unpublish" } :
    kind === "trans" ? { title: "Transfer Site", body: `Transfer this site to ${toName || "another workspace"}? The site stays intact but moves to the new workspace.`, ok: "Transfer" } :
    { title: "Delete Site Permanently", body: "This action cannot be undone. All content and references for this site will be removed.", ok: "Delete Permanently" };
  return (
    <dialog className="modal modal-danger" ref={ref} aria-labelledby="sdz-title" onClose={handleClose} onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }} hidden={!kind}>
      <div className="pf-head">
        <div>
          <h2 id="sdz-title">{t.title}</h2>
          <p>{t.body}</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
          {icon("i-close", 18, 18, "0 0 16 16")}
        </button>
      </div>
      <div className="pf-foot">
        <button type="button" className="btn-outline pf-btn" onClick={() => ref.current?.close()}>Cancel</button>
        <button type="button" className={`btn-primary pf-btn${kind === "del" ? " bad" : ""}`} onClick={onConfirm}>{t.ok}</button>
      </div>
    </dialog>
  );
}

type DomainDialogState = { t: "domain"; prefill: string } | { t: "dns"; domain: string } | null;

export function SettingsView({
  site,
  d,
  branding,
  pixels,
  pendingDomain,
  onConnect,
  onPending,
  counts,
  status,
  workspaceName,
  otherWorkspaces,
  onUnpublish,
  onTransfer,
  onDelete,
  onCreateWorkspace,
  onSaveBranding,
  onSavePixels,
  showToast,
}: {
  site: SiteLite & { name: string };
  d: { domain: string; live: boolean };
  branding: Branding;
  pixels: Pixels;
  pendingDomain: string;
  onConnect: (domain: string) => void;
  onPending: (domain: string) => void;
  counts: { pages: number; articles: number; products: number; orders: number };
  status: "ready" | "setup" | "frozen" | "disabled";
  workspaceName: string;
  otherWorkspaces: Array<{ id: string; name: string; sites: number; members: number }>;
  onUnpublish: () => void;
  onTransfer: (toId: string) => void;
  onDelete: () => void;
  onCreateWorkspace: () => void;
  onSaveBranding: (updater: (b: Branding) => Branding) => void;
  onSavePixels: (updater: (p: Pixels) => Pixels) => void;
  showToast: (text: string) => void;
}) {
  const [tab, setTab] = useState<SsTab>("domain");
  const [draft, setDraft] = useState("");
  const [dlg, setDlg] = useState<DomainDialogState>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const focusTab = (k: SsTab) => tabRefs.current[k]?.focus();
  const openDomain = (prefill: string) => setDlg({ t: "domain", prefill });
  const openDns = (domain: string) => setDlg({ t: "dns", domain });

  const onTabKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = SS_TABS.findIndex((t) => t[0] === tab);
    const next = SS_TABS[(i + (e.key === "ArrowRight" ? 1 : SS_TABS.length - 1)) % SS_TABS.length][0];
    setTab(next);
    requestAnimationFrame(() => focusTab(next));
  };

  const panel =
    tab === "domain" ? (
      <>
        <h2 className="ss-h">Custom Domain Configuration</h2>
        <p className="ss-cur">
          Current Domain: <b>{d.domain}</b>
          <span className={`st${d.live ? "" : " off"}`}>({d.live ? "Active" : "Not live"})</span>
          <span className="dot" aria-hidden="true" />
        </p>
        {pendingDomain ? (
          <p className="ss-pend">
            <span className="dns-dot" aria-hidden="true" />
            <b>{pendingDomain}</b>Pending · waiting for DNS records
            <button type="button" className="btn-text" onClick={() => openDns(pendingDomain)}>View DNS records</button>
          </p>
        ) : null}
        <label className="ss-lbl" htmlFor="ss-domain">Add Custom Domain:</label>
        <div className="ss-add">
          <input
            id="ss-domain"
            autoComplete="off"
            spellCheck={false}
            inputMode="url"
            placeholder="e.g. mybusiness.com"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                openDomain(draft);
              }
            }}
          />
          <button type="button" className="btn-dark" onClick={() => openDomain(draft)}>Connect Domain</button>
        </div>
        <hr />
        <h2 className="ss-h">DNS Records to Point:</h2>
        <ul className="ss-dns">
          {DNS_RECORDS.map((r) => (
            <li key={r.type}>
              <span className="f"><span>Type:</span> <b>{r.type}</b></span><i />
              <span className="f"><span>Host:</span> <b>{r.host}</b></span><i />
              <span className="f v"><span>Value:</span> <b>{r.value}</b></span>
            </li>
          ))}
        </ul>
      </>
    ) : tab === "branding" ? (
      <BrandingPanel site={site} branding={branding} onSave={onSaveBranding} showToast={showToast} />
    ) : tab === "danger" ? (
      <DangerPanel
        status={status}
        live={d.live}
        workspaceName={workspaceName}
        otherWorkspaces={otherWorkspaces}
        counts={counts}
        onUnpublish={onUnpublish}
        onTransfer={onTransfer}
        onDelete={onDelete}
        onCreateWorkspace={onCreateWorkspace}
      />
    ) : tab === "pixels" ? (
      <PixelsPanel site={site} pixels={pixels} onSave={onSavePixels} showToast={showToast} />
    ) : (
      <div className="ss-soon">
        <span className="soon-tag">Coming soon</span>
        <h3 style={{ marginTop: 14 }}>{SS_TABS.find((t) => t[0] === tab)?.[1]}</h3>
        <p>{SS_SOON[tab]}</p>
      </div>
    );

  return (
    <>
      <div className="ov-head">
        <h1 tabIndex={-1}>Site Settings</h1>
        <p>Manage global domain connections, brand identity, tracking scripts, and site deletion.</p>
      </div>

      <div className="ov-card ss-tabs" role="tablist" aria-label="Site settings sections">
        {SS_TABS.map(([k, label, ic]) => (
          <button
            key={k}
            type="button"
            className="ss-tab"
            role="tab"
            id={`ss-tab-${k}`}
            aria-selected={k === tab}
            aria-controls="ss-panel"
            tabIndex={k === tab ? 0 : -1}
            ref={(el) => {
              tabRefs.current[k] = el;
            }}
            onClick={() => {
              setTab(k);
              focusTab(k);
            }}
            onKeyDown={onTabKey}
          >
            {ic}
            {label}
          </button>
        ))}
      </div>
      <section className="ov-card ss-panel" id="ss-panel" role="tabpanel" aria-labelledby={`ss-tab-${tab}`}>
        {panel}
      </section>

      {dlg?.t === "domain" ? (
        <DomainDialog
          key={dlg.prefill}
          prefill={dlg.prefill}
          currentDomain={d.domain}
          onCancel={() => setDlg(null)}
          onVerify={(domain) => setDlg({ t: "dns", domain })}
        />
      ) : null}
      {dlg?.t === "dns" ? (
        <DnsDialog
          key={dlg.domain}
          domain={dlg.domain}
          onBack={() => setDlg({ t: "domain", prefill: dlg.domain })}
          onCancel={() => setDlg(null)}
          onPending={(pending) => {
            onPending(pending);
            setDlg(null);
          }}
          onConnected={() => {
            onConnect(dlg.domain);
            showToast(`${dlg.domain} is connected to ${site.name}. SSL is being set up.`);
          }}
        />
      ) : null}
    </>
  );
}
