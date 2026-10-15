import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { slugify } from "~/lib/slugify";

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
export type Pixels = { ga: string; fb: string; code: string };

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
  return { ga: "", fb: isShopSite(site) ? "123456789012345" : "", code: "" };
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

const PX_RULES = {
  ga: { re: /^G-[A-Z0-9]{6,12}$/, msg: "A Measurement ID looks like G-XXXXXXXXXX (G, a dash, then letters and numbers)." },
  fb: { re: /^\d{15,16}$/, msg: "A Pixel ID is 15 or 16 digits, numbers only." },
};
const codeSnippet = (c: string) => {
  const line = (c || "").split("\n").map((x) => x.trim()).find(Boolean);
  return line || "...custom tracking script...";
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
  const [ga, setGa] = useState(pixels.ga);
  const [fb, setFb] = useState(pixels.fb);
  const [code, setCode] = useState(pixels.code);
  const [errs, setErrs] = useState<{ ga: string; fb: string }>({ ga: "", fb: "" });
  const [copied, setCopied] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const gaRef = useRef<HTMLInputElement>(null);
  const fbRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);

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
        done();
      } catch {
        showToast(text);
      }
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  };

  const openCode = () => {
    setCodeOpen(true);
    requestAnimationFrame(() => codeRef.current?.focus());
  };

  const save = () => {
    let first: "ga" | "fb" | null = null;
    const next = { ga: "", fb: "" };
    (Object.keys(PX_RULES) as ("ga" | "fb")[]).forEach((k) => {
      const v = (k === "ga" ? ga : fb).trim();
      if (v && !PX_RULES[k].re.test(v)) {
        next[k] = PX_RULES[k].msg;
        first = first ?? k;
      }
    });
    setErrs(next);
    if (first) {
      (first === "ga" ? gaRef : fbRef).current?.focus();
      return;
    }
    const c = code.trim();
    if (/<script\b/i.test(c) && !/<\/script>/i.test(c)) {
      if (codeOpen) codeRef.current?.focus();
      else openCode();
      showToast("Your custom code has an opening <script> tag with no closing </script>.");
      return;
    }
    onSave(() => ({ ga: ga.trim(), fb: fb.trim(), code: c }));
    const n = [ga.trim(), fb.trim(), c].filter(Boolean).length;
    showToast(n ? `Tracking saved. ${n} ${n === 1 ? "tool is" : "tools are"} active on ${site.name}.` : "Tracking saved. No tracking tools are active.");
  };

  return (
    <>
      <h2 className="ss-h br-h">Analytics &amp; Pixels</h2>
      <p className="px-sub">Connect your tracking tools and add custom scripts to monitor your site&apos;s performance and behaviour.</p>
      <div className="px-list">
        <div className="px-row tint">
          <span className="px-ic">{I_GA}</span>
          <div>
            <strong>Google Analytics</strong>
            <span className="px-id">
              <label htmlFor="px-ga">Measurement ID:</label>
              <span className="px-br">[</span>{" "}
              <input
                ref={gaRef}
                className="px-in"
                id="px-ga"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="G-XXXXXXXXXX"
                value={ga}
                aria-describedby="px-ga-err"
                aria-invalid={errs.ga ? true : undefined}
                onChange={(e) => {
                  setGa(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""));
                  setErrs((s) => ({ ...s, ga: "" }));
                }}
              />{" "}
              <span className="px-br">]</span>
            </span>
            <p className="px-err" id="px-ga-err" hidden={!errs.ga}>{errs.ga}</p>
          </div>
          <button
            type="button"
            className={`px-copy${copied === "ga" ? " done" : ""}`}
            disabled={!ga.trim()}
            onClick={() => {
              const v = ga.trim();
              if (v) copy(v, "ga");
            }}
          >
            {copied === "ga" ? <>{TICK}Copied</> : <>{COPY_IC}Copy ID</>}
          </button>
        </div>
        <div className="px-row">
          <span className="px-ic">{I_FB}</span>
          <div>
            <strong>Facebook / Meta Pixel</strong>
            <span className="px-id">
              <label htmlFor="px-fb">Pixel ID:</label>
              <span className="px-br">[</span>{" "}
              <input
                ref={fbRef}
                className="px-in"
                id="px-fb"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                placeholder="123456789012345"
                value={fb}
                aria-describedby="px-fb-err"
                aria-invalid={errs.fb ? true : undefined}
                onChange={(e) => {
                  setFb(e.target.value.replace(/\D/g, ""));
                  setErrs((s) => ({ ...s, fb: "" }));
                }}
              />{" "}
              <span className="px-br">]</span>
            </span>
            <p className="px-err" id="px-fb-err" hidden={!errs.fb}>{errs.fb}</p>
          </div>
          <button
            type="button"
            className={`px-copy${copied === "fb" ? " done" : ""}`}
            disabled={!fb.trim()}
            onClick={() => {
              const v = fb.trim();
              if (v) copy(v, "fb");
            }}
          >
            {copied === "fb" ? <>{TICK}Copied</> : <>{COPY_IC}Copy ID</>}
          </button>
        </div>
        <div className="px-row tint">
          <span className="px-ic code">{I_CODE}</span>
          <div>
            <strong>Custom Header Code Injection</strong>
            <span className="px-snip">
              <code id="px-snip">{codeSnippet(code)}</code>
              <button
                type="button"
                className="btn-text"
                id="px-code-toggle"
                aria-expanded={codeOpen}
                aria-controls="px-code"
                onClick={() => {
                  if (codeOpen) setCodeOpen(false);
                  else openCode();
                }}
              >
                {codeOpen ? "Hide editor" : code.trim() ? "Edit" : "Add script"}
              </button>
            </span>
          </div>
          <button type="button" className="btn-dark px-save" id="px-save" onClick={save}>{I_SAVE}Save Tracking Configuration</button>
          <label className="sr-only" htmlFor="px-code">Custom code added to the head of every page</label>
          <textarea
            ref={codeRef}
            className="px-code"
            id="px-code"
            hidden={!codeOpen}
            spellCheck={false}
            placeholder={"<!-- Paste scripts here. They load in the <head> of every page. -->"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
      </div>
    </>
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
