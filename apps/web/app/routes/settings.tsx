import { useEffect, useRef, useState } from "react";
import { redirect, useActionData, useNavigation, useSubmit } from "react-router";
import { useWorkspaceChrome } from "~/components/workspace-shell";
import { Pmark } from "~/components/workspace-sidebar";
import { slugify } from "~/lib/slugify";
import { initials, RolePill } from "~/lib/workspace-views";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { WorkspaceRow } from "~/lib/workspace.server";
import type { Route } from "./+types/settings";

/* renderSettings(), from digital-romanian-screen.html lines 2545-2676.

   The prototype keeps the whole screen in one client-side `draft` object and
   only commits it on Save. That is reproduced here, but the draft is seeded
   from - and written back to - the real workspaces row, because name and slug
   are columns that already exist.

   Two of the profile fields cannot be persisted yet and say so in place
   rather than pretending:

   - Workspace image   workspaces has no logo column, so the upload previews
                       locally and the Save button reports it as not applied.
   - Default language  there is no per-workspace language anywhere in the schema
                       (sites have no locale column either), so the select is
                       rendered with the reason attached.

   Both become one-line changes in the action once the columns exist.

   The URL card lets the owner edit the workspace slug with the prototype's
   same validation (length, hyphens, reserved words, uniqueness) and Save
   persists it. The raw workspace ID is deliberately not shown here.

   Ownership transfer and workspace deletion live in the Danger zone and open
   the two dialogs (#dlg-transfer / #dlg-delete-ws): a radio list plus typed
   confirmation for transfer, a typed-slug confirmation for deletion. Both are
   owner-only and lock themselves (dz-lock) for everyone else. */

const icon = (id: string, w = 16, h = w, vb = `0 0 ${w} ${h}`) => (
  <svg width={w} height={h} viewBox={vb} fill="none" aria-hidden="true">
    <use href={`#${id}`} />
  </svg>
);

const sv = (vb: string, body: React.ReactNode, w = 16, h = w) => (
  <svg width={w} height={h} viewBox={vb} fill="none" aria-hidden="true">
    {body}
  </svg>
);

const LINK = sv("0 0 20 20", <path d="M8.5 11.5a3.2 3.2 0 0 0 4.6 0l2.6-2.6a3.2 3.2 0 0 0-4.6-4.6l-.9.9M11.5 8.5a3.2 3.2 0 0 0-4.6 0l-2.6 2.6a3.2 3.2 0 0 0 4.6 4.6l.9-.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />, 20);
const COPY = sv("0 0 16 16", <><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" stroke="currentColor" strokeWidth="1.4" /></>, 15);
const WARN = sv("0 0 16 16", <path d="M8 5.5v3M8 11h.01M6.9 2.6 1.8 11.6A1.3 1.3 0 0 0 2.9 13.5h10.2a1.3 1.3 0 0 0 1.1-1.9L9.1 2.6a1.3 1.3 0 0 0-2.2 0Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />, 15);
const WARN18 = sv("0 0 20 20", <path d="M10 7v4M10 14h.01M8.6 3.2 2.2 14.5A1.6 1.6 0 0 0 3.6 17h12.8a1.6 1.6 0 0 0 1.4-2.5L11.4 3.2a1.6 1.6 0 0 0-2.8 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />, 18);
const LOCK = sv("0 0 16 16", <><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.4" /></>, 13);
const SWAPU = sv("0 0 20 20", <><circle cx="7" cy="6.5" r="2.6" stroke="currentColor" strokeWidth="1.5" /><path d="M2.5 16c.4-2.6 2.2-4 4.5-4s4.1 1.4 4.5 4M13 6.5h4.5l-1.8-1.8M17.5 10.5H13l1.8 1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>, 18);
const TRASH = sv("0 0 20 20", <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5 5.5l.8 10.6a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L15 5.5M8.5 9v5M11.5 9v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />, 18);
const TRASH16 = sv("0 0 20 20", <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5 5.5l.8 10.6a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L15 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />, 16);
const CHECK = sv("0 0 16 16", <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />, 14);
const GRID = sv("0 0 20 20", <><rect x="2.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" /><rect x="11.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" /><rect x="2.5" y="11.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" /><rect x="11.5" y="11.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" /></>, 20);
const GLOBE = sv("0 0 20 20", <><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6" /><path d="M2.5 10h15M10 2.5c2.2 2.3 2.2 12.7 0 15M10 2.5c-2.2 2.3-2.2 12.7 0 15" stroke="currentColor" strokeWidth="1.6" /></>, 20);
const UPLOAD = sv("0 0 16 16", <path d="M8 10.5V2.5M4.8 5.5 8 2.3l3.2 3.2M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />, 16);
const SWAP = sv("0 0 16 16", <><circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" /><path d="M5.6 7.2a2.6 2.6 0 0 1 4.6-1.1M10.4 8.8a2.6 2.6 0 0 1-4.6 1.1M10.4 4.8v1.6H8.8M5.6 11.2V9.6h1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></>, 16);
const CAM = sv("0 0 12 12", <><path d="M2 4.2a.8.8 0 0 1 .8-.8h1.3l.7-1h2.4l.7 1h1.3a.8.8 0 0 1 .8.8v4.5a.8.8 0 0 1-.8.8H2.8a.8.8 0 0 1-.8-.8z" stroke="currentColor" strokeWidth="1" /><circle cx="6" cy="6.3" r="1.5" stroke="currentColor" strokeWidth="1" /></>, 9);
const CLOSE = sv("0 0 16 16", <path d="M12 4 4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />);
const TRANSFER_ICON = sv("0 0 20 20", <path d="M3 7h12l-3-3M17 13H5l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />, 18);
const DELETE_ICON = sv("0 0 20 20", <path d="M10 7v4M10 14h.01M8.6 3.2 2.2 14.5A1.6 1.6 0 0 0 3.6 17h12.8a1.6 1.6 0 0 0 1.4-2.5L11.4 3.2a1.6 1.6 0 0 0-2.8 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />, 18);

const LANGS = [
  ["ro", "Romanian"],
  ["en", "English"],
  ["hu", "Hungarian"],
  ["de", "German"],
  ["fr", "French"],
] as const;

const RESERVED = ["app", "api", "admin", "www", "settings", "login", "signin", "signup", "help", "support", "billing"];

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });

  const { data: mine } = await supabase
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = mine?.role ?? "";

  /* ---------- Transfer ownership ---------- */
  if (intent === "transfer-ownership") {
    if (role !== "owner") return { error: "Only the owner can transfer ownership." };
    const targetId = String(formData.get("userId") ?? "");
    if (!targetId || targetId === user.id) return { error: "Pick another member to make the owner." };

    const { data: target } = await supabase
      .from("workspace_memberships")
      .select("user_id, role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", targetId)
      .maybeSingle();
    if (!target) return { error: "That person isn't a member of this workspace." };
    if (target.role === "owner") return { error: "That person already owns this workspace." };

    const up = await supabase
      .from("workspace_memberships")
      .update({ role: "owner" })
      .eq("workspace_id", workspaceId)
      .eq("user_id", targetId);
    if (up.error) return { error: "We couldn't transfer ownership. Try again in a moment." };

    const down = await supabase
      .from("workspace_memberships")
      .update({ role: "administrator" })
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id);
    if (down.error) return { error: "Ownership moved, but your own role couldn't be downgraded." };

    return { transferred: true };
  }

  /* ---------- Delete workspace ----------
     The one action in this screen RLS cannot undo, so it demands a typed
     confirmation of the exact workspace slug (GitHub-style) before POSTing. */
  if (intent === "delete-workspace") {
    if (role !== "owner") return { error: "Only the owner can delete the workspace." };

    // Remove the memberships first so the workspace row is no longer referenced
    // even on hosts where the FK is not ON DELETE CASCADE. The app shows
    // nothing once this user has no membership at all, so the redirect below
    // lands on workspace onboarding.
    await supabase.from("workspace_memberships").delete().eq("workspace_id", workspaceId);
    const { error } = await supabase.from("workspaces").delete().eq("id", workspaceId);
    if (error) return { error: "We couldn't delete that workspace. Try again in a moment." };

    throw redirect("/onboarding/workspace");
  }

  /* ---------- Save (default) ---------- */
  if (!name) return { error: "Give your workspace a name.", field: "name" };

  if (role !== "owner" && role !== "administrator") {
    return { error: "Only owners and admins can change workspace settings." };
  }

  const slug = String(formData.get("slug") ?? "").trim();
  if (slug.length < 3) return { error: "Workspace URL must be at least 3 characters.", field: "slug" };
  if (/^-|-$/.test(slug)) return { error: "The workspace URL can\u2019t start or end with a hyphen.", field: "slug" };
  if (RESERVED.includes(slug)) return { error: `\u201C${slug}\u201D is reserved. Try another URL.`, field: "slug" };
  const { data: taken } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (taken && taken.id !== workspaceId) {
    return { error: `app.digitalromanian.ro/${slug} is taken. Try another URL.`, field: "slug" };
  }

  const { error } = await supabase.from("workspaces").update({ name, slug } as never).eq("id", workspaceId);
  if (error) return { error: "We couldn't save that. Try again in a moment." };

  /* Be honest about the two columns that do not exist rather than reporting a
     partial save as a complete one. */
  return {
    saved: true,
    skipped: [
      formData.get("logoPending") === "true" ? "Workspace image" : null,
      formData.get("langPending") === "true" ? "Default language" : null,
    ].filter(Boolean) as string[],
  };
}

/* ------------------------------------------------------ native <dialog>
   The standalone file calls showModal()/close() on #dlg-transfer and
   #dlg-delete-ws. These dialogs are rendered only while open; this hook keeps
   the platform dialog open/closed in step with the prop (and re-shows it if
   it was closed with Escape, which the browser does natively). */
function useOpenDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);
  return ref;
}

function TransferDialog({
  workspace,
  yourEmail,
  submitting,
  onClose,
  onTransfer,
  onInvite,
}: {
  workspace: WorkspaceRow;
  yourEmail: string;
  submitting: boolean;
  onClose: () => void;
  onTransfer: (userId: string) => void;
  onInvite: () => void;
}) {
  const candidates = workspace.members.filter((m) => m.email !== yourEmail);
  const [to, setTo] = useState("");
  const [ack, setAck] = useState(false);
  const [confirm, setConfirm] = useState("");
  const ready = Boolean(to) && ack && confirm.trim().toUpperCase() === "TRANSFER";
  const ref = useOpenDialog(true);

  return (
    <dialog
      className="modal modal-danger"
      ref={ref}
      aria-labelledby="tr-title"
      aria-describedby="tr-desc"
      onClickCapture={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !submitting) onTransfer(to);
        }}
        noValidate
      >
        <div className="modal-head">
          <div className="dh">
            <span className="dh-ic neutral">{TRANSFER_ICON}</span>
            <div>
              <h2 id="tr-title">Transfer ownership</h2>
              <p id="tr-desc">
                Choose who will own <strong id="tr-ws">{workspace.name}</strong>. You&apos;ll stay on as an Admin.
              </p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            {CLOSE}
          </button>
        </div>
        <div className="modal-body">
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="confirm-label">New owner</legend>
            {candidates.length ? (
              <div className="tlist" id="tr-list" role="radiogroup">
                {candidates.map((m) => {
                  const value = m.userId ?? m.email;
                  return (
                    <label key={value}>
                      <input
                        type="radio"
                        name="tr-to"
                        value={value}
                        checked={to === value}
                        onChange={() => setTo(value)}
                      />
                      <Pmark name={m.name} email={m.email} size={32} />
                      <div>
                        <strong>{m.name || m.email}</strong>
                        <small>{m.email}</small>
                      </div>
                      <RolePill role={m.role} />
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="tempty" id="tr-invite">
                There&apos;s no one else in {workspace.name} yet. Invite a teammate first, then come back to hand over
                ownership.
                <div>
                  <button type="button" className="btn-dark" onClick={onInvite}>
                    {icon("i-plus", 18)}Invite member
                  </button>
                </div>
              </div>
            )}
          </fieldset>
          {candidates.length ? (
            <>
              <label className="ack">
                <input
                  type="checkbox"
                  id="tr-ack"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                <span>
                  I understand the new owner gets full control of billing, the team and every site, and only they can
                  transfer ownership back.
                </span>
              </label>
              <label className="confirm-label" htmlFor="tr-confirm">
                Type <code>TRANSFER</code> to confirm
              </label>
              <input
                className="auth-input confirm-input"
                id="tr-confirm"
                autoComplete="off"
                spellCheck={false}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </>
          ) : null}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn-outline btn-inline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary btn-inline" id="tr-submit" disabled={!ready || submitting}>
            Transfer ownership
          </button>
        </div>
      </form>
    </dialog>
  );
}

function DeleteDialog({
  workspace,
  submitting,
  onClose,
  onDelete,
}: {
  workspace: WorkspaceRow;
  submitting: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const n = workspace.sites.length;
  const pub = workspace.sites.filter((s) => s.status === "published").length;
  const others = workspace.members.length - 1;
  const [confirm, setConfirm] = useState("");
  const ready = confirm.trim() === workspace.slug;
  const ref = useOpenDialog(true);

  return (
    <dialog
      className="modal modal-danger"
      ref={ref}
      aria-labelledby="dw-title"
      aria-describedby="dw-desc"
      onClickCapture={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !submitting) onDelete();
        }}
        noValidate
      >
        <div className="modal-head">
          <div className="dh">
            <span className="dh-ic">{DELETE_ICON}</span>
            <div>
              <h2 id="dw-title">
                Delete <span id="dw-ws">{workspace.name}</span>?
              </h2>
              <p id="dw-desc">This can&apos;t be undone. Everything below is removed permanently.</p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            {CLOSE}
          </button>
        </div>
        <div className="modal-body">
          <ul className="dlist" id="dw-list">
            <li>
              {CLOSE}
              <span>
                <b>
                  {n} {n === 1 ? "site" : "sites"}
                </b>
                {pub ? ` (${pub} published and live)` : ""}, with all their pages and content
              </span>
            </li>
            <li>
              {CLOSE}
              <span>
                <b>All media and assets</b>: images, files, fonts and uploads
              </span>
            </li>
            <li>
              {CLOSE}
              <span>
                <b>Templates and components</b> saved in this workspace
              </span>
            </li>
            {others ? (
              <li>
                {CLOSE}
                <span>
                  <b>
                    {others} {others === 1 ? "person loses" : "people lose"} access
                  </b>
                  , including pending invites
                </span>
              </li>
            ) : (
              <li>
                {CLOSE}
                <span>
                  <b>Workspace settings</b> and activity history
                </span>
              </li>
            )}
          </ul>
          <label className="confirm-label" htmlFor="dw-confirm">
            Type <code>{workspace.slug}</code> to confirm
          </label>
          <input
            className="auth-input confirm-input"
            id="dw-confirm"
            autoComplete="off"
            spellCheck={false}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="modal-foot">
          <button type="button" className="btn-outline btn-inline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-danger" id="dw-submit" disabled={!ready || submitting}>
            Delete workspace
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function WorkspaceSettings() {
  const chrome = useWorkspaceChrome();
  const { data: screen, currentId, openInvite } = chrome;
  const workspace = screen.workspaces.find((w) => w.id === currentId) ?? screen.workspaces[0] ?? undefined;
  const youRole = workspace?.members.find((m) => m.email === screen.email.toLowerCase())?.role ?? "viewer";
  const canEdit = youRole === "owner" || youRole === "administrator";
  const isOwner = youRole === "owner";
  const owner = workspace?.members.find((m) => m.role === "owner");
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const submit = useSubmit();

  /* The draft, seeded from the row. The prototype keeps the same fields in a
     client-side `draft` and only commits on Save. */
  const [name, setName] = useState(workspace?.name ?? "");
  const [logo, setLogo] = useState<string | null>(null);
  const [lang, setLang] = useState<string>("ro");
  const [slug, setSlug] = useState(workspace?.slug || slugify(workspace?.name ?? "") || "untitled");
  const [nameError, setNameError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!workspace) {
    return (
      <>
        <div className="wsd-head">
          <div>
            <p className="eyebrow">General settings</p>
            <h1 tabIndex={-1}>Workspace settings</h1>
            <p>Manage your workspace details and preferences.</p>
          </div>
        </div>
        <div className="empty">
          <h2>No workspace yet</h2>
          <p>Create a workspace first and its settings will appear here.</p>
          <div className="row">
            <a className="btn-dark" href="/onboarding/workspace">
              Create a workspace
            </a>
          </div>
        </div>
      </>
    );
  }

  const nameChanged = name.trim() !== workspace.name;
  const slugChanged = slug !== workspace.slug;
  const dirty = nameChanged || logo !== null || lang !== "ro" || slugChanged;
  const saved = actionData && "saved" in actionData ? actionData : null;
  const skipped: string[] = saved && "skipped" in saved && Array.isArray(saved.skipped) ? saved.skipped : [];
  const transferred = actionData && "transferred" in actionData;

  const slugError = (s: string) => {
    if (s.length < 3) return "Use at least 3 characters.";
    if (/^-|-$/.test(s)) return "The URL can\u2019t start or end with a hyphen.";
    if (RESERVED.includes(s)) return `\u201C${s}\u201D is reserved. Try another URL.`;
    if (screen.workspaces.some((x) => x !== workspace && x.slug === s)) {
      return `app.digitalromanian.ro/${s} is taken. Try another URL.`;
    }
    return "";
  };
  const err = slugChanged ? slugError(slug) : "";

  const save = () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    submit(
      {
        intent: "save-settings",
        workspaceId: workspace.id,
        name: name.trim(),
        slug,
        logoPending: logo !== null ? "true" : "false",
        langPending: lang !== "ro" ? "true" : "false",
      },
      { method: "post" },
    );
  };

  const copySlug = () => {
    try {
      void navigator.clipboard.writeText(`app.digitalromanian.ro/${slug}`);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <div className="wsd-head">
        <div>
          <p className="eyebrow">General settings</p>
          <h1 tabIndex={-1}>Workspace settings</h1>
          <p>Manage your workspace details and preferences.</p>
        </div>
        <div className="wsd-tools">
          <button
            type="button"
            className="btn-save"
            disabled={!dirty || !canEdit || submitting}
            onClick={save}
            title={canEdit ? undefined : "Only owners and admins can change workspace settings."}
          >
            Save
          </button>
          <button type="button" className="btn-dark" onClick={openInvite}>
            {icon("i-plus", 18)}
            <span>
              Invite <span className="long">member</span>
            </span>
          </button>
        </div>
      </div>

      <section className="setcard" aria-labelledby="set-title">
        <h2 id="set-title">Workspace Profile</h2>
        <div className="setcols">
          <div className="setcol">
            <span className="sic">
              <span className="ws-av">
                {logo ? <img src={logo} alt="" /> : initials(name.trim() || workspace.name).slice(0, 1) || "W"}
                <span className="cam">{CAM}</span>
              </span>
            </span>
            <div className="sbody">
              <span className="slabel">Workspace image</span>
              <p className="shelp" style={{ marginTop: 12 }}>
                Upload a logo or image to represent your workspace. Recommended size: 400 × 400px (PNG, JPG)
              </p>
              <div className="sbtns">
                <label className="sbtn dark">
                  {UPLOAD}Upload image
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="set-file"
                    aria-label="Upload workspace image"
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setLogo(String(reader.result ?? ""));
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                <label className="sbtn light">
                  {SWAP}Change image
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="set-file"
                    aria-label="Change workspace image"
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setLogo(String(reader.result ?? ""));
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
              <p className="shelp" role="status" style={{ marginTop: 10 }}>
                {logo
                  ? "Preview only. The workspaces table has no image column yet, so Save stores the name and reports this as skipped."
                  : "No image set."}
              </p>
            </div>
          </div>

          <div className="setcol">
            <span className="sic">{GRID}</span>
            <div className="sbody">
              <label className="slabel" htmlFor="set-name">
                Workspace name
              </label>
              <p className="stitle">{name.trim() || workspace.name}</p>
              <p className="shelp">This name will be visible to your team members and across your workspace.</p>
              <div className="sfield">
                <input
                  className="sinput"
                  id="set-name"
                  maxLength={48}
                  autoComplete="organization"
                  aria-describedby="set-name-err"
                  aria-invalid={nameError ? "true" : undefined}
                  disabled={!canEdit}
                  value={name}
                  onChange={(e) => {
                    setName(e.currentTarget.value);
                    setNameError(false);
                  }}
                />
              </div>
              <p className="serr" id="set-name-err" hidden={!nameError}>
                Give your workspace a name.
              </p>
            </div>
          </div>

          <div className="setcol">
            <span className="sic round">{GLOBE}</span>
            <div className="sbody">
              <label className="stitle big" htmlFor="set-lang">
                Default language
              </label>
              <p className="shelp" style={{ marginTop: 12 }}>
                Set the default language for your sites and content.
              </p>
              <div className="sfield lang">
                <span className={`flag ${lang}`} />
                <select
                  id="set-lang"
                  value={lang}
                  onChange={(e) => setLang(e.currentTarget.value)}
                  title="Not stored yet: there is no language column on workspaces or sites."
                >
                  {LANGS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <p className="shelp" role="status" style={{ marginTop: 10 }}>
                Applies to new sites once a language column exists. Nothing is saved from this field today.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="setcard url-card" aria-labelledby="url-title">
        <span className="sic">{LINK}</span>
        <div>
          <h2 id="url-title">Workspace URL</h2>
          <p className="shelp">
            The address your team uses to open this workspace. Lowercase letters, numbers and hyphens only.
          </p>
          <div className="url-row">
            <div className="input-group" id="set-slug-wrap" aria-invalid={err ? "true" : undefined}>
              <span className="prefix">app.digitalromanian.ro/</span>
              <label className="sr-only" htmlFor="set-slug">
                Workspace URL
              </label>
              <input
                id="set-slug"
                spellCheck={false}
                autoComplete="off"
                maxLength={40}
                aria-describedby="set-slug-status set-slug-note"
                disabled={!canEdit}
                value={slug}
                onChange={(e) => {
                  const v = e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-");
                  setSlug(v);
                }}
              />
            </div>
            <button type="button" className="url-copy" id="set-slug-copy" onClick={copySlug}>
              {COPY}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className={`url-status ${err ? "bad" : slugChanged ? "ok" : "idle"}`} id="set-slug-status" aria-live="polite">
            {err ? err : slugChanged ? (
              <>
                {CHECK}app.digitalromanian.ro/{slug} is available
              </>
            ) : (
              "This is your current workspace URL."
            )}
          </p>
          <p className="url-note" id="set-slug-note" hidden={!slugChanged || Boolean(err)}>
            {WARN}
            <span>
              Links and bookmarks that use <strong id="set-slug-old">app.digitalromanian.ro/{workspace.slug}</strong>{" "}
              will stop working once you save. Let your team know about the new address.
            </span>
          </p>
        </div>
      </section>

      <section className={`danger-zone${isOwner ? "" : " locked"}`} aria-labelledby="dz-title">
        <div className="dz-head">
          <div className="dz-t">
            <span className="dz-ic">{WARN18}</span>
            <div>
              <h2 id="dz-title">Danger zone</h2>
              <p>Irreversible actions. Please be certain before you continue.</p>
            </div>
          </div>
          {isOwner ? (
            <span className="owner-badge">
              {LOCK}
              Workspace owner only
            </span>
          ) : null}
        </div>
        {isOwner ? null : (
          <p className="dz-lock">
            {LOCK}
            <span>
              Only <strong>{owner ? owner.name || owner.email : "the workspace owner"}</strong> can transfer ownership
              or delete this workspace. Ask them if something here needs to change.
            </span>
          </p>
        )}
        <div className="dz-row">
          <span className="ric">{SWAPU}</span>
          <div>
            <strong>Transfer ownership</strong>
            <p>Transfer ownership to another team member.</p>
            <small className="dz-sub">They get full control of billing, the team and every site. You become an Admin.</small>
          </div>
          <button type="button" className="btn-danger-ghost" disabled={!isOwner} onClick={() => setTransferOpen(true)}>
            Transfer ownership
          </button>
        </div>
        <div className="dz-row delete">
          <span className="ric">{TRASH}</span>
          <div>
            <strong>Delete workspace</strong>
            <p>Permanently delete all sites, media and assets.</p>
            <small className="dz-sub">
              This removes {workspace.name} for everyone. Members lose access straight away.
            </small>
            <div className="meta">
              <span>
                {workspace.sites.length} {workspace.sites.length === 1 ? "site" : "sites"}
              </span>
              <span>
                {workspace.members.length} {workspace.members.length === 1 ? "member" : "members"}
              </span>
              <span>All media &amp; assets</span>
            </div>
          </div>
          <button type="button" className="btn-danger" disabled={!isOwner} onClick={() => setDeleteOpen(true)}>
            {TRASH16}Delete workspace
          </button>
        </div>
      </section>

      {saved ? (
        <p className="alert-success" role="status" style={{ marginTop: 20 }}>
          Workspace settings saved
          {skipped.length ? `. Not applied yet: ${skipped.join(", ").toLowerCase()}.` : "."}
        </p>
      ) : null}
      {transferred ? (
        <p className="alert-success" role="status" style={{ marginTop: 20 }}>
          Ownership transferred. You&apos;re now an administrator of this workspace.
        </p>
      ) : null}
      {actionData && "error" in actionData && actionData.error ? (
        <p className="alert-error" role="alert" style={{ marginTop: 20 }}>
          {actionData.error}
        </p>
      ) : null}

      {transferOpen ? (
        <TransferDialog
          workspace={workspace}
          yourEmail={screen.email.toLowerCase()}
          submitting={submitting}
          onClose={() => setTransferOpen(false)}
          onTransfer={(userId) => {
            setTransferOpen(false);
            submit({ intent: "transfer-ownership", workspaceId: workspace.id, userId }, { method: "post" });
          }}
          onInvite={() => {
            setTransferOpen(false);
            openInvite();
          }}
        />
      ) : null}
      {deleteOpen ? (
        <DeleteDialog
          workspace={workspace}
          submitting={submitting}
          onClose={() => setDeleteOpen(false)}
          onDelete={() => {
            setDeleteOpen(false);
            submit({ intent: "delete-workspace", workspaceId: workspace.id }, { method: "post" });
          }}
        />
      ) : null}
    </>
  );
}