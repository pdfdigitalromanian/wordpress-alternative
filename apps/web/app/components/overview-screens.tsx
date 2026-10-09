import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { slugify } from "~/lib/slugify";

/* Website Pages (#/overview/pages) and E-Commerce / Store → Products
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
  status: "published" | "draft";
  img: string | null;
  desc: string;
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
  p.status === "draft" ? (
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

const FILTERS: Record<string, string> = { all: "All products", published: "Published", draft: "Draft", out: "Out of stock" };
type FilterKey = "all" | "published" | "draft" | "out";

const PER_PAGE = 8;

export function ProductsView({
  site,
  products,
  setProducts,
  showToast,
  showToastAction,
}: {
  site: SiteLite;
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
        (filter === "out" ? p.stock === 0 && p.status !== "draft" : filter === "draft" ? p.status === "draft" : p.status === "published" && p.stock > 0)) &&
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

  const toggleStatus = (src: Product) => {
    const now: "published" | "draft" = src.status === "draft" ? "published" : "draft";
    setProducts((list) => list.map((x) => (x.id === src.id ? { ...x, status: now } : x)));
    showToast(`${src.name} ${now === "draft" ? "moved to draft" : "published"}`);
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
                      { kind: "item", label: "Duplicate", onSelect: () => duplicate(p) },
                      { kind: "item", label: p.status === "draft" ? "Publish" : "Move to draft", onSelect: () => toggleStatus(p) },
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
  onCancel,
  onSubmit,
}: {
  products: Product[];
  edit: Product | null;
  onCancel: () => void;
  onSubmit: (data: ProductDraft, edit: Product | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
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
      },
      edit,
    );
  };

  const err = (id: string) => errors[id] || "";

  return (
    <dialog
      className="modal modal-product"
      ref={ref}
      aria-labelledby="pf-title"
      aria-describedby="pf-sub"
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <form noValidate onSubmit={submit}>
        <div className="pf-head">
          <div>
            <h2 id="pf-title">{edit ? "Edit Product" : "Add Product"}</h2>
            <p id="pf-sub">{edit ? "Update this product’s details" : "Add a new product to your store"}</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
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
        </div>

        <div className="pf-foot">
          <button type="button" className="btn-outline pf-btn" onClick={() => ref.current?.close()}>Cancel</button>
          <button type="submit" className="btn-primary pf-btn">{edit ? "Save Changes" : "Add Product"}</button>
        </div>
      </form>
    </dialog>
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
          <h1 tabIndex={-1}>Website Pages</h1>
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
        <div className="wtab" role="table" aria-label="Website pages">
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
                    <span className="wic">{wIcon(p.ic)}</span>
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
              return (
                <div className="ctab-row" role="row" key={c.id}>
                  <span className="ccell" role="cell">
                    <span className="cthumb" style={{ "--tb": c.tint } as CSSProperties} aria-hidden="true">
                      {c.emoji}
                      {c.photo ? <img src={photoUrl(c.photo)} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} /> : null}
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
  onSubmit: (data: { name: string; slug: string; parent: string | null; desc: string }, edit: Category | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);
  const [name, setName] = useState(edit?.name ?? "");
  const [slug, setSlug] = useState(edit?.slug ?? "");
  const [parent, setParent] = useState(edit?.parent ?? "");
  const [desc, setDesc] = useState(edit?.desc ?? "");
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
    onSubmit({ name: trimmedName, slug: trimmedSlug, parent: parent || null, desc: desc.trim() }, edit);
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
