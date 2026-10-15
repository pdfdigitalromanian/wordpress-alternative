import { useEffect, useMemo, useRef, useState } from "react";
import { Form, redirect, useActionData, useNavigate, useNavigation } from "react-router";
import { hasWorkspace } from "~/lib/landing";
import { slugify } from "~/lib/slugify";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { handleWorkspaceAction } from "~/lib/workspace-actions.server";
import type { Route } from "./+types/new-site";

/* Create a new website: the 3-step wizard from the standalone file
   (#/new-site/category → /name → /domain). The step lives in component state
   rather than three child routes so moving between steps doesn't re-run the
   loader or remount the screen. */

const wsvg = (path: React.ReactNode) => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

const WIZ_CATS = [
  { k: "store", label: "Online store", hint: "Sell products with a cart and checkout", words: ["Store", "Shop", "Market"], icon: wsvg(<><path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.1" /><circle cx="9.5" cy="19.5" r="1.2" /><circle cx="17" cy="19.5" r="1.2" /></>) },
  { k: "portfolio", label: "Portfolio", hint: "Show off your work and projects", words: ["Studio", "Works", "Portfolio"], icon: wsvg(<><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.2" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" /></>) },
  { k: "services", label: "Offering services", hint: "Bookings, pricing and enquiries", words: ["Services", "Solutions", "Consulting"], icon: wsvg(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18" /></>) },
  { k: "blog", label: "Blog", hint: "Articles, news and updates", words: ["Journal", "Notes", "Blog"], icon: wsvg(<><path d="M5 3.5h10l4 4V20a.5.5 0 0 1-.5.5h-13A.5.5 0 0 1 5 20z" /><path d="M14.5 3.5V8H19M8.5 12h7M8.5 15.5h7M8.5 8.5h3" /></>) },
  { k: "landing", label: "Landing page", hint: "One page for a launch or campaign", words: ["Launch", "Hub", "Online"], icon: wsvg(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 8.5h18M7 13h6M7 16h4" /><rect x="15" y="12" width="3" height="4.5" rx=".5" /></>) },
  { k: "nonprofit", label: "Non-profit organization", hint: "Causes, donations and volunteers", words: ["Foundation", "Initiative", "Trust"], icon: wsvg(<path d="M12 20s-7.5-4.4-7.5-10A4.5 4.5 0 0 1 12 7.2 4.5 4.5 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" />) },
  { k: "tech", label: "Tech company", hint: "Product pages, docs and careers", words: ["Labs", "Technologies", "Digital"], icon: wsvg(<><rect x="3" y="4.5" width="18" height="12" rx="1.5" /><path d="M2 19.5h20M10 8.5l-2 2 2 2M14 8.5l2 2-2 2" /></>) },
  { k: "restaurant", label: "Restaurant", hint: "Menu, opening hours and reservations", words: ["Kitchen", "Bistro", "Eatery"], icon: wsvg(<path d="M6 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M8 12v9M17 21V3c-1.9 1-3 3.4-3 6.5V13h3" />) },
  { k: "event", label: "Promoting an event", hint: "Schedule, speakers and tickets", words: ["Live", "Summit", "Fest"], icon: wsvg(<><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4M8 14h2.5M13.5 14H16M8 17h2.5" /></>) },
] as const;

const siteSlug = (n: string) => slugify(n).replace(/-/g, "") || "mysite";

const normDomain = (v: string) =>
  v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/^www\./, "").replace(/\.$/, "");
const DOMAIN_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

/* Suggestions come from the "root" of what was typed, so picking one never
   stacks extra words on top. */
function wizRoot(name: string) {
  const all = WIZ_CATS.flatMap((c) => c.words).join("|");
  return name.trim().replace(/^the\s+/i, "").replace(new RegExp(`\\s+(${all})$`, "i"), "").trim();
}

/* No category picked: guess one from the description, otherwise a plain
   landing page. */
const CAT_WORDS: Record<string, RegExp> = {
  store: /\b(shop|store|sell|product|ecommerce|e-commerce)/i,
  restaurant: /\b(restaurant|food|menu|cafe|kitchen|bar)\b/i,
  blog: /\b(blog|articles?|write|journal|news)\b/i,
  portfolio: /\b(portfolio|photograph|design|artist|my work)/i,
  event: /\b(event|conference|wedding|festival|tickets?)\b/i,
  nonprofit: /\b(charity|non-?profit|ngo|donat|volunteer)/i,
  tech: /\b(software|app|saas|tech|startup)\b/i,
  services: /\b(services?|consult|agency|clients?|booking)/i,
};
const guessCat = (t: string) => (Object.entries(CAT_WORDS).find(([, re]) => re.test(t || "")) || ["landing"])[0];

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw redirect("/login");
  if (!String(user.user_metadata?.display_name ?? "")) throw redirect("/onboarding/profile");
  if (!(await hasWorkspace(request, user))) throw redirect("/onboarding/workspace");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  formData.set("intent", "create-site");
  const result = await handleWorkspaceAction(request, formData);
  if ("error" in result) return result;
  if ("created" in result) {
    const domain = String(formData.get("domain") ?? "").trim();
    const params = new URLSearchParams();
    if (result.siteId) params.set("site", result.siteId);
    if (domain) params.set("domain", domain);
    const qs = params.toString();
    throw redirect(`/overview${qs ? `?${qs}` : ""}`);
  }
  return result;
}

type Step = "category" | "name" | "domain";

function WizHead({ step, onCancel }: { step: number; onCancel: () => void }) {
  return (
    <>
      <div className="wiz-top">
        <p className="onb-step">Step {step} of 3</p>
        <button type="button" className="btn-text wiz-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div className="wiz-bar" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <i className={i <= step ? "on" : ""} key={i} />
        ))}
      </div>
    </>
  );
}

export default function NewSite() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("category");
  const [cat, setCat] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [err, setErr] = useState("");
  const descRef = useRef<HTMLTextAreaElement>(null);

  const submitting = navigation.state === "submitting";
  const actionError = actionData && "error" in actionData ? actionData.error : "";
  const continueDisabled = !cat && !desc.trim();

  /* The description textarea grows to fit its content (rows=1 + measured height). */
  useEffect(() => {
    if (step !== "category") return;
    const t = descRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = t.scrollHeight + 2 + "px";
  }, [desc, step]);

  const suggestions = useMemo(() => {
    const c = WIZ_CATS.find((x) => x.k === cat) ?? WIZ_CATS[0];
    const root = wizRoot(name);
    return root ? c.words.map((w) => `${root} ${w}`) : [];
  }, [cat, name]);

  const cancel = () => navigate("/workspace");

  const cont = () => {
    setCat((cur) => cur ?? guessCat(desc));
    setStep("name");
  };
  const skip = () => {
    setCat((cur) => cur ?? guessCat(desc));
    setStep("name");
  };

  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr("");
      setStep("name");
      return;
    }
    setErr("");
    setStep("domain");
  };

  const submitDomain = (e: React.FormEvent) => {
    const raw = domain.trim();
    const d = normDomain(raw);
    let msg = "";
    if (raw && !DOMAIN_RE.test(d)) msg = `"${raw}" isn't a valid domain. Use something like mybusiness.com, or leave it blank.`;
    else if (raw && /(^|\.)digitalromanian\.(ro|com|site)$/.test(d)) msg = "Use a domain you own, or leave it blank to use your free address.";
    setErr(msg);
    if (msg) e.preventDefault();
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-inner wiz">
          {step === "category" ? (
            <>
              <WizHead step={1} onCancel={cancel} />
              <div className="wiz-about">
                <h1 tabIndex={-1}>First, what is your site all about?</h1>
                <label className="sr-only" htmlFor="wiz-desc">Describe your site or business</label>
                <textarea
                  className="wiz-desc"
                  id="wiz-desc"
                  ref={descRef}
                  rows={1}
                  maxLength={400}
                  placeholder="Describe your site or business in a few sentences"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !continueDisabled) {
                      e.preventDefault();
                      cont();
                    }
                  }}
                />
                <div className="wiz-chips" role="group" aria-label="Or pick a category">
                  {WIZ_CATS.map((c) => (
                    <button
                      type="button"
                      className="wiz-chip"
                      key={c.k}
                      aria-pressed={cat === c.k}
                      onClick={() => setCat((cur) => (cur === c.k ? null : c.k))}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="wiz-foot wiz-foot3">
                <button type="button" className="wiz-back" onClick={cancel}>
                  <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Back
                </button>
                <span className="spacer" />
                <button type="button" className="btn-text wiz-skip" onClick={skip}>Skip</button>
                <button type="button" className="btn-primary" disabled={continueDisabled} onClick={cont}>Continue</button>
              </div>
            </>
          ) : step === "name" ? (
            <>
              <WizHead step={2} onCancel={cancel} />
              <h1 tabIndex={-1}>What do you want to call your site?</h1>
              <p className="auth-lead">Enter your site name below or pick a suggested name based on your category.</p>
              <form className="wiz-form" noValidate onSubmit={submitName}>
                <div className="auth-field">
                  <label htmlFor="wiz-name">Site name</label>
                  <input
                    className="auth-input"
                    id="wiz-name"
                    maxLength={48}
                    autoComplete="off"
                    placeholder="e.g. Debaz Farm"
                    value={name}
                    aria-describedby="wiz-addr"
                    onChange={(e) => {
                      setName(e.target.value);
                      setErr("");
                    }}
                    autoFocus
                  />
                </div>
                <p className="wiz-hint" id="wiz-addr">
                  Your site address will automatically be <b>{siteSlug(name || "yoursite")}.digitalromanian.site</b>
                </p>
                <p className="wiz-sugs-h">Suggested names</p>
                <div className="wiz-sugs" id="wiz-sugs">
                  {suggestions.length ? (
                    suggestions.map((n) => (
                      <button
                        type="button"
                        className="wiz-sug"
                        key={n}
                        aria-pressed={n.toLowerCase() === name.trim().toLowerCase()}
                        onClick={() => {
                          setName(n);
                          setErr("");
                        }}
                      >
                        {n}
                      </button>
                    ))
                  ) : (
                    <p className="wiz-hint" style={{ margin: 0 }}>Start typing a name and we&apos;ll suggest a few versions.</p>
                  )}
                </div>
                <p className="alert-error" role="alert" hidden={!!name.trim()}>Give your site a name.</p>
                <div className="wiz-foot">
                  <button type="button" className="btn-outline" onClick={() => setStep("category")}>
                    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ transform: "scaleX(-1)" }}><use href="#i-arrow-right" /></svg>
                    Back
                  </button>
                  <button type="submit" className="btn-primary">
                    Continue
                    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true"><use href="#i-arrow-right" /></svg>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <WizHead step={3} onCancel={cancel} />
              <h1 tabIndex={-1}>Connect a custom domain</h1>
              <p className="auth-lead">Enter your domain name if you already own one, or leave it blank to connect later.</p>
              <Form className="wiz-form" method="post" noValidate onSubmit={submitDomain}>
                <input type="hidden" name="intent" value="create-site" />
                <input type="hidden" name="siteName" value={name} />
                <div className="auth-field">
                  <div className="field-row">
                    <label htmlFor="wiz-domain">Custom domain name</label>
                    <span className="opt">Optional</span>
                  </div>
                  <input
                    className="auth-input"
                    id="wiz-domain"
                    name="domain"
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="url"
                    placeholder="e.g. mybusiness.com"
                    value={domain}
                    aria-describedby="wiz-dhint"
                    onChange={(e) => {
                      setDomain(e.target.value);
                      setErr("");
                    }}
                  />
                </div>
                <p className="wiz-hint" id="wiz-dhint">
                  Your site will be live at <b>{siteSlug(name)}.digitalromanian.site</b> straight away. If you add a domain, we&apos;ll show you the DNS records to set up after launch.
                </p>
                <p className="alert-error" role="alert" hidden={!err && !actionError}>
                  {err || actionError}
                </p>
                <div className="wiz-foot">
                  <button type="button" className="btn-outline" onClick={() => setStep("name")}>
                    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ transform: "scaleX(-1)" }}><use href="#i-arrow-right" /></svg>
                    Back
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    Launch site
                  </button>
                </div>
              </Form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
