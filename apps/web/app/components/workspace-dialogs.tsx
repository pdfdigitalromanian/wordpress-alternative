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

/* ROLES and ROLE_SHORT, from the standalone file. Only the four roles the
   schema's workspace_role enum allows can be stored; author is shown because
   the file lists it, but the action falls back to editor for it. */
const ROLES: Record<string, { label: string }> = {
  admin: { label: "Admin" },
  editor: { label: "Editor" },
  author: { label: "Author" },
  viewer: { label: "Viewer" },
};

const ROLE_SHORT: Record<string, string> = {
  admin: "Manage members, settings and sites",
  editor: "Edit and publish sites",
  author: "Write content, can't publish",
  viewer: "View only",
};

/** Storable roles, mapped to the enum: author has no column value, so it is
 *  stored as editor and the Team view still labels it correctly. */
const ROLE_FOR_DB: Record<string, string> = { admin: "administrator", editor: "editor", author: "editor", viewer: "viewer" };

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
  const [picked, setPicked] = useState<{ name: string; email: string }[]>([]);
  const [typed, setTyped] = useState("");
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [role, setRole] = useState("editor");
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleActive, setRoleActive] = useState(0);
  const [access, setAccess] = useState<"all" | "some">("all");
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  // openInvite() resets every field each time it is opened.
  useEffect(() => {
    if (!open) return;
    setPicked([]);
    setTyped("");
    setOptions([]);
    setActiveIdx(-1);
    setRole("editor");
    setRoleOpen(false);
    setAccess("all");
    setSiteIds([]);
    setError(null);
    const t = window.setTimeout(() => emailRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const serverError = actionResult && "error" in actionResult ? actionResult.error : null;

  const roleKeys = useMemo(() => Object.keys(ROLE_SHORT), []);

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

  const submit = () => {
    if (options.length && activeIdx >= 0) pick(options[activeIdx]);
    else if (typed.trim() && !addTyped()) return;
    if (!picked.length) {
      setError("Add at least one email address.");
      emailRef.current?.focus();
      return;
    }
  };

  const canSend = picked.length > 0 || EMAIL_RE.test(typed.trim()) || activeIdx >= 0;
  const someDisabled = !workspace?.sites.length;

  return (
    <dialog
      className="modal modal-invite"
      id="dlg-invite"
      aria-labelledby="invite-title"
      ref={dlg.ref}
      onClose={dlg.onClose}
      onClick={dlg.backdrop}
      onKeyDown={(e) => {
        // The standalone file's dlgInvite 'cancel' handler: Escape closes the
        // role menu first, then the suggestion list, then the dialog.
        if (e.key !== "Escape") return;
        if (roleOpen) {
          e.stopPropagation();
          setRoleOpen(false);
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
        <input type="hidden" name="role" value={ROLE_FOR_DB[role] ?? "editor"} />
        {/* One field per picked chip. Without these the chips are display-only
            and the action receives no addresses at all. */}
        {picked.map((p) => (
          <input key={p.email} type="hidden" name="email" value={p.email} />
        ))}
        <input type="hidden" name="access" value={access} />

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
                  aria-expanded={roleOpen}
                  aria-controls="invite-role-menu"
                  aria-label="Role"
                  onClick={() => {
                    setRoleActive(roleKeys.indexOf(role));
                    setRoleOpen((o) => !o);
                  }}
                >
                  <span>{ROLES[role]?.label ?? "Editor"}</span>
                  {icon("i-chevron-down", 14, 14, "0 0 16 16")}
                </button>
                {roleOpen ? (
                  <ul className="role-menu" id="invite-role-menu" role="listbox" aria-label="Role">
                    {roleKeys.map((k, i) => (
                      <li
                        role="option"
                        id={`role-${k}`}
                        key={k}
                        aria-selected={k === role}
                        className={i === roleActive ? "active" : ""}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setRole(k);
                          setRoleOpen(false);
                        }}
                      >
                        <span>
                          <strong>{ROLES[k].label}</strong>
                          <small>{ROLE_SHORT[k]}</small>
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

          {/* syncAccess(): the site list is only shown for "Selected sites". */}
          <div className="inv-access">
            <span id="invite-access-label">Access</span>
            <div className="seg" role="radiogroup" aria-labelledby="invite-access-label">
              <label>
                <input type="radio" name="invite-access" checked={access === "all"} onChange={() => setAccess("all")} />
                <span>All sites</span>
              </label>
              <label title={someDisabled ? "This workspace has no sites yet" : ""}>
                <input
                  type="radio"
                  checked={access === "some"}
                  disabled={someDisabled}
                  onChange={() => setAccess("some")}
                />
                <span>Selected sites</span>
              </label>
            </div>
          </div>

          {access === "some" ? (
            <div className="site-pills" id="invite-sites">
              {workspace?.sites.map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={siteIds.includes(s.id)}
                    onChange={(e) => setSiteIds((ids) => (e.target.checked ? [...ids, s.id] : ids.filter((i) => i !== s.id)))}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
            </div>
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
