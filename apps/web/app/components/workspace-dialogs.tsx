/* The two <dialog> elements at the bottom of digital-romanian-screens.html
   (#dlg-invite and #dlg-create-ws) plus its #toast, ported to React.

   The standalone file drives them with showModal()/close() and a small state
   object. Here they are rendered only while open and closed by unmounting,
   which is the same observable behaviour. Every validation message, default
   and label is taken from that file's script (openInvite / addTyped /
   memberState / paintChips / buildSuggest / openCreateWs / resetWsForm / toast)
   so the copy matches exactly. */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { Pmark, Wmark } from "~/components/workspace-sidebar";
import { slugify } from "~/lib/slugify";
import type { WorkspaceRow } from "~/lib/workspace.server";
import type { WorkspaceActionResult } from "~/lib/workspace-actions.server";

const icon = (id: string, w = 16, h = w, vb = `0 0 ${w} ${h}`) => (
  <svg width={w} height={h} viewBox={vb} fill="none" aria-hidden="true">
    <use href={`#${id}`} />
  </svg>
);

/* --------------------------------------------------------- native <dialog>

   digital-romanian-screens.html opens its two modals with a single delegated
   handler and the platform's own dialog behaviour:

     document.addEventListener('click', e => {
       const o = e.target.closest('[data-open]');
       if (o) { e.preventDefault(); ...; o.dataset.open === 'invite' ? openInvite() : openCreateWs(); }
     });
     function openCreateWs() { ...; dCreate.showModal(); f.wsname.focus(); }
     $$('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
     $$('dialog.modal').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

   This hook is that handler for one dialog. Keeping it delegated (rather than
   an onClick prop) is what makes any `data-open` button work on any screen,
   which is how the standalone file behaves and how the sidebar's
   "Create new workspace" is wired there. */
function useNativeDialog(open: boolean, onClose: () => void, openKey: string) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const trigger = (e.target as HTMLElement | null)?.closest?.("[data-open]");
      if (trigger?.getAttribute("data-open") !== openKey) return;
      e.preventDefault();
      // The file closes the switcher / workspace menu before opening.
      document.dispatchEvent(new CustomEvent("ws:close-overlays"));
      if (ref.current && !ref.current.open) ref.current.showModal();
    };

    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [openKey]);

  return {
    ref,
    // `e.target === el` is the backdrop: clicks inside land on the form or a
    // control, clicks on the dialog's own padding land on the dialog.
    backdrop: (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) ref.current?.close();
    },
    onClose,
  };
}

/* Workspace-level roles for an invite. There are two: Admin manages billing,
   team and every site; Contributor is granted access per site below. The enum
   has no "contributor" value, so the dialog posts "contributor" and the action
   stores editor on the membership row. */
const W_ROLES: Record<string, { label: string; short: string }> = {
  admin: { label: "Admin", short: "Manage billing, team and all sites" },
  contributor: { label: "Contributor", short: "Access only the sites they're assigned to" },
};

/* The four per-site roles, exactly as digital-romanian-screen.html declares
   them (lines 2527-2536): same keys, labels, descriptions, tints and icons. */
const SITE_ROLES = [
  {
    value: "admin",
    label: "Admin",
    desc: "Full control: settings, domains and publishing",
    tc: "#f3e4d4",
    path: <path d="M8 2l5 2v4c0 3-2.2 5.2-5 6-2.8-.8-5-3-5-6V4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />,
  },
  {
    value: "editor",
    label: "Editor",
    desc: "Edit pages and design, and publish changes",
    tc: "#dfe8f7",
    path: <path d="M10.5 3l2.5 2.5L6 12.5H3.5V10z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />,
  },
  {
    value: "content",
    label: "Content editor",
    desc: "Write and update content. Can’t publish or change design",
    tc: "#dcefe2",
    path: (
      <>
        <path d="M4 2.5h5.5L12 5v8.5H4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6 8h4M6 10.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
  },
  {
    value: "shop",
    label: "Shop manager",
    desc: "Manage products, orders and customers",
    tc: "#fbe7c6",
    path: (
      <>
        <path d="M3.5 5.5h9l-.8 8h-7.4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6 5.5V4.5a2 2 0 0 1 4 0v1" stroke="currentColor" strokeWidth="1.4" />
      </>
    ),
  },
] as const;

type SiteRole = (typeof SITE_ROLES)[number];

/** roleTile() in the standalone file: a tinted square with the role's icon. */
const RoleTile = ({ role, size = 14 }: { role: SiteRole; size?: number }) => (
  <span className="rt" style={{ "--tc": role.tc } as React.CSSProperties}>
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {role.path}
    </svg>
  </span>
);

const ROLE_FOR_DB: Record<string, string> = { admin: "administrator", contributor: "editor" };

const PURPOSES = [
  { label: "Client sites", icon: "i-website", w: 16, h: 16 },
  { label: "My business", icon: "i-store", w: 16, h: 16 },
  { label: "Online shop", icon: "i-shop", w: 30, h: 26 },
  { label: "Blog", icon: "i-blog", w: 30, h: 28 },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** One row of the invite suggestion list: a known person from the directory,
 *  or a raw address that has no account yet (`isNew`). */
type Suggestion = { name: string; email: string; isNew?: boolean; note?: string };

/* ------------------------------------------------------------------ toast */

export function Toast({ text, link }: { text: string; link?: { label: string; onClick: () => void } }) {
  return (
    <div className="toast show" role="status" aria-live="polite">
      <span>{text}</span>
      {link ? (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            link.onClick();
          }}
        >
          {link.label}
        </a>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------ create workspace */

export function CreateWorkspaceDialog({
  open,
  onClose,
  actionResult,
}: {
  open: boolean;
  onClose: () => void;
  actionResult: WorkspaceActionResult | undefined;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [purpose, setPurpose] = useState("");
  const [localError, setLocalError] = useState<{ msg: string; field: string } | null>(null);

  const fieldId = useId();
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  // resetWsForm() runs on every open.
  useEffect(() => {
    if (!open) return;
    setLogo(null);
    setSlugEdited(false);
    setName("");
    setSlug("");
    setPurpose("");
    setLocalError(null);
    const t = window.setTimeout(() => nameRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const serverError = actionResult && "error" in actionResult ? actionResult : undefined;
  const error = localError ?? (serverError ? { msg: serverError.error, field: (serverError as { field?: string }).field ?? "wsname" } : null);

  const dlg = useNativeDialog(open, onClose, "create-ws");

  const paintFace = () => logo ? <img src={logo} alt="" /> : name.trim().charAt(0).toUpperCase() || icon("i-image", 24);

  return (
    <dialog
      className="modal"
      id="dlg-create-ws"
      aria-labelledby="cws-title"
      ref={dlg.ref}
      onClose={dlg.onClose}
      onClick={dlg.backdrop}
    >
      <Form method="post" onSubmit={() => setLocalError(null)}>
        <input type="hidden" name="intent" value="create-workspace" />
        <div className="modal-head">
          <div>
            <h2 id="cws-title">Create workspace</h2>
          </div>
          <button type="button" className="icon-btn" data-close aria-label="Close" onClick={onClose}>
            {icon("i-close", 16, 16, "0 0 16 16")}
          </button>
        </div>

        <div className="modal-body">
          {/* wsFieldsHTML() in the standalone file. */}
          <div className="picker square">
            <label className="picker-mark">
              <span className="picker-face">{paintFace()}</span>
              <span className="picker-badge" aria-hidden="true">
                {icon("i-pencil", 14)}
              </span>
              <input
                type="file"
                accept="image/*"
                aria-label="Upload a workspace logo"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setLogo(String(reader.result));
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            <div className="picker-copy">
              <strong>Logo</strong>
              <p>Optional</p>
              <button type="button" className="btn-text" hidden={!logo} onClick={() => setLogo(null)}>
                Remove logo
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor={`${fieldId}-name`}>
              Workspace name <span className="req" aria-hidden="true">*</span>
            </label>
            <input
              id={`${fieldId}-name`}
              name="wsname"
              ref={nameRef}
              required
              maxLength={48}
              className="auth-input"
              placeholder="e.g. Nova Studio or Acme Clients"
              autoComplete="organization"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugEdited) setSlug(slugify(e.target.value));
              }}
            />
          </div>

          <div className="auth-field">
            <label htmlFor={`${fieldId}-slug`}>Workspace URL</label>
            <div className="input-group">
              <span className="prefix">app.digitalromanian.ro/</span>
              <input
                id={`${fieldId}-slug`}
                name="wsslug"
                spellCheck={false}
                placeholder="your-workspace"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-"));
                }}
              />
            </div>
          </div>

          <fieldset className="purpose auth-field">
            <legend>
              <span className="field-row">
                <span>What&apos;s it for?</span>
                <span className="opt">Optional</span>
              </span>
            </legend>
            <div className="purpose-grid">
              {PURPOSES.map((p) => (
                <label className="ptile" key={p.label}>
                  <input
                    type="radio"
                    name="wspurpose"
                    value={p.label}
                    checked={purpose === p.label}
                    onChange={() => setPurpose(p.label)}
                  />
                  <span className="pic">{icon(p.icon, p.w, p.h, p.w === 16 ? "0 0 16 16" : undefined)}</span>
                  <span className="plabel">{p.label}</span>
                  <svg className="pcheck" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <use href="#i-check" />
                  </svg>
                </label>
              ))}
            </div>
          </fieldset>

          {error ? (
            <p className="alert-error" role="alert">
              {error.msg}
            </p>
          ) : null}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-outline btn-inline" data-close onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary btn-inline" disabled={busy}>
            Create workspace
          </button>
        </div>
      </Form>
    </dialog>
  );
}

/* --------------------------------------------------------- invite member */

export function InviteDialog({
  open,
  onClose,
  workspace,
  knownPeople,
  actionResult,
}: {
  open: boolean;
  onClose: () => void;
  workspace: WorkspaceRow | undefined;
  /** Everyone who already shares a workspace with the signed-in user; this is
   *  the real stand-in for the standalone file's demo DIRECTORY. */
  knownPeople: { name: string; email: string }[];
  actionResult: WorkspaceActionResult | undefined;
}) {
  const emailRef = useRef<HTMLInputElement>(null);
  const sroleBtnRef = useRef<HTMLButtonElement>(null);
  const srolePopRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<{ name: string; email: string }[]>([]);
  const [typed, setTyped] = useState("");
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [wrole, setWrole] = useState<"admin" | "contributor">("contributor");
  const [wroleOpen, setWroleOpen] = useState(false);
  const [wroleActive, setWroleActive] = useState(0);
  const [access, setAccess] = useState<"all" | "some">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [siteRole, setSiteRole] = useState<string>("editor");
  const [sroleOpen, setSroleOpen] = useState(false);
  const [sroleActive, setSroleActive] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  // openInvite() resets every field each time it is opened. The role defaults
  // to Contributor and, like the standalone file, a contributor starts on
  // "Selected sites" when the workspace has any.
  useEffect(() => {
    if (!open) return;
    setPicked([]);
    setTyped("");
    setOptions([]);
    setActiveIdx(-1);
    setWrole("contributor");
    setWroleOpen(false);
    setAccess(workspace?.sites.length ? "some" : "all");
    setSelectedIds([]);
    setSiteRole("editor");
    setSroleOpen(false);
    setSroleActive(0);
    setError(null);
    const t = window.setTimeout(() => emailRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, workspace?.sites.length]);

  const serverError = actionResult && "error" in actionResult ? actionResult.error : null;

  const roleKeys = useMemo(() => Object.keys(W_ROLES), []);

  // The HTML points the site-role popup upwards when it would run off the
  // bottom of the screen; the class is applied after the pop renders.
  useEffect(() => {
    if (!sroleOpen) return;
    const pop = srolePopRef.current;
    if (!pop) return;
    const r = pop.getBoundingClientRect();
    pop.classList.toggle("up", r.bottom > window.innerHeight - 12);
  }, [sroleOpen]);

  const currentSiteRole = SITE_ROLES.find((r) => r.value === siteRole) ?? SITE_ROLES[1];

  // memberState(): what the file already knows about an address. Pending
  // invitations cannot be read back — the applied schema stores no invited
  // address — so an address is either picked, already a member, or unknown.
  const memberState = (email: string) => {
    const e = email.toLowerCase();
    if (picked.some((p) => p.email.toLowerCase() === e)) return "Added";
    if (workspace?.members.some((m) => m.email?.toLowerCase() === e)) return "Already a member";
    return "";
  };

  // buildSuggest()
  useEffect(() => {
    const q = typed.trim().toLowerCase();
    if (!q) {
      setOptions([]);
      setActiveIdx(-1);
      return;
    }
    const found: Suggestion[] = knownPeople
      .filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .slice(0, 5)
      .map((p) => ({ ...p, note: memberState(p.email) }));
    if (EMAIL_RE.test(q) && !found.some((o) => o.email.toLowerCase() === q)) {
      found.push({ name: "", email: typed.trim(), isNew: true, note: memberState(typed.trim()) });
    }
    setOptions(found);
    setActiveIdx(found.findIndex((o) => !o.note));
    // memberState is derived from picked/workspace inside this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, knownPeople, picked, workspace]);

  const dlg = useNativeDialog(open, onClose, "invite");

  const pick = (o: Suggestion | undefined) => {
    if (!o || o.note) return;
    setPicked((p) => [...p, { name: o.name, email: o.email }]);
    setTyped("");
    setOptions([]);
    setError(null);
  };

  // addTyped()
  const addTyped = () => {
    const v = typed.trim().replace(/[,;]$/, "");
    if (!v) return false;
    if (!EMAIL_RE.test(v)) {
      setError(`"${v}" isn't a valid email address.`);
      return false;
    }
    const known = knownPeople.find((p) => p.email.toLowerCase() === v.toLowerCase());
    const note = memberState(v);
    if (note) {
      setError(`${v}: ${note.toLowerCase()}.`);
      return false;
    }
    pick({ name: known ? known.name : "", email: v });
    return true;
  };

  // applyRoleAccess(): Admins manage billing, the team and every site, so
  // their access is fixed to All sites and there is no per-site role row.
  // Contributors only get the sites they're given, so they start on Selected.
  const chooseRole = (k: "admin" | "contributor") => {
    setWrole(k);
    setWroleOpen(false);
    if (k === "admin") {
      setAccess("all");
      setSroleOpen(false);
    } else if (workspace?.sites.length) {
      setAccess("some");
    }
  };

  const someDisabled = wrole === "admin" || !workspace?.sites.length;

  const toggleSite = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = () => {
    if (options.length && activeIdx >= 0) pick(options[activeIdx]);
    else if (typed.trim() && !addTyped()) return;
    if (!picked.length) {
      setError("Add at least one email address.");
      emailRef.current?.focus();
      return;
    }
    if (access === "some" && !selectedIds.length) {
      setError("Pick at least one site.");
      return;
    }
  };

  const canSend = picked.length > 0 || EMAIL_RE.test(typed.trim()) || activeIdx >= 0;

  return (
    <dialog
      className="modal modal-invite"
      id="dlg-invite"
      aria-labelledby="invite-title"
      ref={dlg.ref}
      onClose={dlg.onClose}
      onClick={dlg.backdrop}
      onClickCapture={(e) => {
        // The standalone file's delegated dInvite clicks: a click outside the
        // open popover closes it before anything else handles the event.
        const t = e.target as HTMLElement;
        if (sroleOpen && !t.closest(".srole-pick")) setSroleOpen(false);
        if (wroleOpen && !t.closest(".role-pick")) setWroleOpen(false);
      }}
      onKeyDown={(e) => {
        // The standalone file's dlgInvite 'cancel' handler: Escape closes the
        // site-role popup, then the role menu, then the suggestion list.
        if (e.key !== "Escape") return;
        if (sroleOpen) {
          e.stopPropagation();
          setSroleOpen(false);
        } else if (wroleOpen) {
          e.stopPropagation();
          setWroleOpen(false);
        } else if (options.length) {
          e.stopPropagation();
          setOptions([]);
          setActiveIdx(-1);
        }
      }}
    >
      <Form method="post" onSubmit={submit}>
        <input type="hidden" name="intent" value="invite" />
        {workspace ? <input type="hidden" name="workspaceId" value={workspace.id} /> : null}
        <input type="hidden" name="role" value={wrole} />
        <input type="hidden" name="access" value={access} />
        {access === "some"
          ? selectedIds.map((id) => <input key={id} type="hidden" name="siteId" value={id} />)
          : null}
        {wrole === "contributor" ? <input type="hidden" name="siteRole" value={siteRole} /> : null}
        {/* One field per picked chip. Without these the chips are display-only
            and the action receives no addresses at all. */}
        {picked.map((p) => (
          <input key={p.email} type="hidden" name="email" value={p.email} />
        ))}

        <div className="modal-head inv-head">
          <div className="inv-title">
            <Wmark workspace={workspace} size={32} />
            <h2 id="invite-title">
              Invite to <span>{workspace?.name ?? ""}</span>
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            {icon("i-close", 16, 16, "0 0 16 16")}
          </button>
        </div>

        <div className="modal-body">
          <div className="inv-field">
            {/* paintChips(): one chip per picked person, the input after them. */}
            <div className="chip-input" id="invite-chips">
              {picked.map((p, i) => (
                <span className="echip" key={p.email}>
                  <Pmark name={p.name} email={p.email} size={22} />
                  <span>{p.name || p.email}</span>
                  <button type="button" aria-label={`Remove ${p.email}`} onClick={() => setPicked((list) => list.filter((_, j) => j !== i))}>
                    {icon("i-close", 12, 12, "0 0 16 16")}
                  </button>
                </span>
              ))}
              <label className="sr-only" htmlFor="invite-email">
                Email addresses
              </label>
              <input
                id="invite-email"
                ref={emailRef}
                type="text"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                placeholder={picked.length ? "Add more" : "Name or email"}
                role="combobox"
                aria-expanded={options.length > 0}
                aria-controls="invite-suggest"
                aria-autocomplete="list"
                aria-activedescendant={activeIdx >= 0 ? `opt-${activeIdx}` : undefined}
                value={typed}
                onChange={(e) => {
                  setError(null);
                  setTyped(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const enabled = options.map((o, i) => (o.note ? -1 : i)).filter((i) => i >= 0);
                    if (!enabled.length) return;
                    const at = enabled.indexOf(activeIdx);
                    setActiveIdx(
                      e.key === "ArrowDown"
                        ? enabled[(at + 1) % enabled.length]
                        : enabled[(at - 1 + enabled.length) % enabled.length],
                    );
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (options.length && activeIdx >= 0) pick(options[activeIdx]);
                    else addTyped();
                  } else if (e.key === "Backspace" && !typed && picked.length) {
                    e.preventDefault();
                    setPicked((list) => list.slice(0, -1));
                  }
                }}
              />
              <div className="role-pick">
                <button
                  type="button"
                  className="role-btn"
                  aria-haspopup="listbox"
                  aria-expanded={wroleOpen}
                  aria-controls="invite-role-menu"
                  aria-label="Role in this workspace"
                  onClick={() => {
                    setWroleActive(roleKeys.indexOf(wrole));
                    setWroleOpen((o) => !o);
                  }}
                >
                  <span>{W_ROLES[wrole]?.label ?? "Admin"}</span>
                  {icon("i-chevron-down", 14, 14, "0 0 16 16")}
                </button>
                {wroleOpen ? (
                  <ul
                    className="role-menu"
                    id="invite-role-menu"
                    role="listbox"
                    aria-label="Role in this workspace"
                    tabIndex={-1}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault();
                        setWroleActive((a) => (a + (e.key === "ArrowDown" ? 1 : roleKeys.length - 1)) % roleKeys.length);
                      } else if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        chooseRole(roleKeys[wroleActive] as "admin" | "contributor");
                      } else if (e.key === "Escape" || e.key === "Tab") {
                        e.preventDefault();
                        setWroleOpen(false);
                      }
                    }}
                  >
                    {roleKeys.map((k, i) => (
                      <li
                        role="option"
                        id={`role-${k}`}
                        key={k}
                        aria-selected={k === wrole}
                        className={i === wroleActive ? "active" : ""}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => chooseRole(k as "admin" | "contributor")}
                      >
                        <span>
                          <strong>{W_ROLES[k].label}</strong>
                          <small>{W_ROLES[k].short}</small>
                        </span>
                        {icon("i-check", 16, 16, "0 0 24 24")}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>

          {options.length ? (
            <ul className="suggest" id="invite-suggest" role="listbox" aria-label="Suggestions">
              {options.map((o, i) => (
                <li
                  role="option"
                  id={`opt-${i}`}
                  key={o.email}
                  aria-disabled={o.note ? "true" : undefined}
                  aria-selected={i === activeIdx}
                  className={o.isNew ? "new" : ""}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    pick(o);
                    emailRef.current?.focus();
                  }}
                >
                  {o.isNew ? (
                    <span className="pmark" style={{ "--s": "32px" } as React.CSSProperties} aria-hidden="true">
                      {icon("i-send", 14)}
                    </span>
                  ) : (
                    <Pmark name={o.name} email={o.email} size={32} />
                  )}
                  <div>
                    <strong>{o.isNew ? o.email : o.name}</strong>
                    <small>{o.isNew ? "Invite by email" : o.email}</small>
                  </div>
                  {o.note ? <em>{o.note}</em> : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="inv-access">
            <span id="invite-access-label">Access</span>
            <div className="seg" role="radiogroup" aria-labelledby="invite-access-label">
              <label>
                <input
                  type="radio"
                  name="invite-access"
                  value="all"
                  checked={access === "all"}
                  onChange={() => setAccess("all")}
                />
                <span>All sites</span>
              </label>
              <label title={someDisabled ? (wrole === "admin" ? "Admins can access all sites" : "This workspace has no sites yet") : undefined}>
                <input
                  type="radio"
                  name="invite-access"
                  value="some"
                  id="invite-access-some"
                  disabled={someDisabled}
                  checked={access === "some"}
                  onChange={() => setAccess("some")}
                />
                <span>Selected sites</span>
              </label>
            </div>
          </div>

          {/* site-pills: shown only while "Selected sites" is on. */}
          <div className="site-pills" id="invite-sites" hidden={access !== "some"} aria-label="Sites to grant access to">
            {workspace?.sites.map((s) => (
              <label key={s.id}>
                <input
                  type="checkbox"
                  value={s.id}
                  checked={selectedIds.includes(s.id)}
                  onChange={() => toggleSite(s.id)}
                />
                <span>{s.name}</span>
              </label>
            ))}
          </div>

          {/* The per-site role dropdown: hidden for an Admin, who reaches every
            site. The chosen role is sent with the invite, though nothing in the
            schema stores it yet. */}
          <div className="inv-access" hidden={wrole === "admin"}>
            <span id="srole-label">Site role</span>
            <div className="srole-pick">
              <button
                ref={sroleBtnRef}
                type="button"
                className="srole-btn"
                id="srole-btn"
                aria-haspopup="listbox"
                aria-expanded={sroleOpen}
                aria-controls="srole-list"
                aria-labelledby="srole-label srole-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setSroleActive(SITE_ROLES.findIndex((r) => r.value === siteRole));
                  setSroleOpen((o) => !o);
                }}
              >
                <RoleTile role={currentSiteRole} size={13} />
                <span className="lbl">{currentSiteRole.label}</span>
                {icon("i-chevron-down", 14, 14, "0 0 16 16")}
              </button>
              {sroleOpen ? (
                <div className="srole-pop" id="srole-pop" ref={srolePopRef}>
                  <ul
                    role="listbox"
                    id="srole-list"
                    tabIndex={-1}
                    aria-labelledby="srole-label"
                    onKeyDown={(e) => {
                      const n = SITE_ROLES.length;
                      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault();
                        setSroleActive((a) => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
                      } else if (e.key === "Home" || e.key === "End") {
                        e.preventDefault();
                        setSroleActive(e.key === "Home" ? 0 : n - 1);
                      } else if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSiteRole(SITE_ROLES[sroleActive].value);
                        setSroleOpen(false);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        setSroleOpen(false);
                      } else if (e.key === "Tab") {
                        setSroleOpen(false);
                      }
                    }}
                  >
                    {SITE_ROLES.map((r, i) => (
                      <li
                        role="option"
                        id={`srole-opt-${r.value}`}
                        data-srole={r.value}
                        key={r.value}
                        aria-selected={siteRole === r.value}
                        className={i === sroleActive ? "active" : ""}
                        onMouseMove={() => setSroleActive(i)}
                        onClick={() => {
                          setSiteRole(r.value);
                          setSroleOpen(false);
                        }}
                      >
                        <RoleTile role={r} size={16} />
                        <span>
                          <strong>{r.label}</strong>
                          <small>{r.desc}</small>
                        </span>
                        {icon("i-check", 16, 16, "0 0 24 24")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          {wrole === "contributor" && workspace?.sites.length && access === "some" ? (
            <p className="srole-note">Gives this role to the sites you selected.</p>
          ) : null}

          {error ?? serverError ? (
            <p className="alert-error" role="alert">
              {error ?? serverError}
            </p>
          ) : null}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-outline btn-inline" data-close onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary btn-inline" id="invite-send" disabled={!canSend || busy}>
            {picked.length > 1 ? `Send ${picked.length} invites` : "Send invite"}
          </button>
        </div>
      </Form>
    </dialog>
  );
}
