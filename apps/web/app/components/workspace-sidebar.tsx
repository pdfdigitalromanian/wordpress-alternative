import { useEffect, useRef, useState } from "react";
import { Form, Link, NavLink, useNavigate } from "react-router";
import type { WorkspaceScreenData, WorkspaceRow } from "~/lib/workspace.server";

/* The one sidebar used by /workspace (and its Templates, Team and General
   settings views) and by /admin. Class names, measurements and element order
   come from digital-romanian-screens.html's .wsd-side; admin previously had its
   own .admin-sidebar, which had drifted from it, so both render this.

   `open` is owned by the shell, not by this component. It used to keep its own
   copy of the mobile-drawer state, which is why the menu button in the header
   did nothing: the two never agreed. */

const icon = (id: string, w = 16, h = w, vb = `0 0 ${w} ${h}`) => (
  <svg width={w} height={h} viewBox={vb} fill="none" aria-hidden="true">
    <use href={`#${id}`} />
  </svg>
);

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function Pmark({ name, email, size = 32 }: { name: string; email?: string; size?: number }) {
  return (
    <span className="pmark" style={{ "--s": `${size}px` } as React.CSSProperties} aria-hidden="true">
      {initials(name || email || "")}
    </span>
  );
}

export function Wmark({ workspace, size = 32 }: { workspace?: WorkspaceRow; size?: number }) {
  if (!workspace) {
    return (
      <span className="wmark icon" style={{ "--s": `${size}px` } as React.CSSProperties} aria-hidden="true">
        {icon("i-plus", 18)}
      </span>
    );
  }
  return (
    <span className="wmark" style={{ "--s": `${size}px` } as React.CSSProperties} aria-hidden="true">
      {initials(workspace.name).slice(0, 1)}
    </span>
  );
}

export type SidebarNavItem = {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
};

export function WorkspaceSidebar({
  data,
  navItems,
  activeKey,
  currentId,
  onSwitch,
  onOpenCreateWs,
  onOpenInvite,
  open,
  onClose,
  showAccount = true,
}: {
  data: WorkspaceScreenData;
  navItems: SidebarNavItem[];
  /** For links that are not plain Router links the caller highlights itself. */
  activeKey?: string;
  currentId: string | null;
  onSwitch: (id: string) => void;
  onOpenCreateWs: () => void;
  onOpenInvite: () => void;
  open: boolean;
  onClose: () => void;
  showAccount?: boolean;
}) {
  const { userName, email, workspaces } = data;
  const [wsOpen, setWsOpen] = useState(false);
  const [wsQuery, setWsQuery] = useState("");

  const wsBtnRef = useRef<HTMLButtonElement>(null);
  const wsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wsPanelRef.current?.contains(e.target as Node) || wsBtnRef.current?.contains(e.target as Node)) return;
      setWsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [wsOpen]);

  const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0];
  const q = wsQuery.trim().toLowerCase();
  const matches = q ? workspaces.filter((w) => w.name.toLowerCase().includes(q)) : workspaces;

  return (
    <aside className={`wsd-side${open ? " open" : ""}`} id="wsd-side" aria-label="Workspace">
      <div style={{ display: "flex", alignItems: "center", paddingRight: 12 }}>
        <Link className="wsd-brand" to="/workspace" onClick={onClose}>
          <svg className="dr-logo" width="40" height="32" viewBox="0 0 40 32" fill="none" aria-hidden="true">
            <use href="#i-dr-logo" />
          </svg>
          Digital Romanian
        </Link>
        <button className="icon-btn menu-close" aria-label="Close menu" onClick={onClose}>
          {icon("i-close", 18, 18, "0 0 16 16")}
        </button>
      </div>

      <nav className="wsd-nav" aria-label="Workspace sections">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose} aria-current={activeKey === item.label ? "page" : undefined}>
            {icon(item.icon, 16)}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="wsd-foot">
        <button
          ref={wsBtnRef}
          className="ws-switch"
          aria-haspopup="true"
          aria-expanded={wsOpen}
          aria-controls="ws-menu"
          onClick={() => setWsOpen((o) => !o)}
        >
          <Wmark workspace={current} size={34} />
          <span className="txt">
            <strong>{current ? current.name : "No workspace yet"}</strong>
            <small>Switch workspace</small>
          </span>
          <svg className="chev" width="16" height="16" viewBox="0 0 18 17" fill="none" aria-hidden="true">
            <use href="#i-chevron-right" />
          </svg>
        </button>

        {wsOpen ? (
          <div className="ws-menu" id="ws-menu" ref={wsPanelRef}>
            <div className="ws-menu-scroll">
              <div className="switcher-search">
                {icon("i-search", 16)}
                <label className="sr-only" htmlFor="ws-menu-search">
                  Search workspaces
                </label>
                <input
                  id="ws-menu-search"
                  type="search"
                  placeholder="Search workspaces"
                  autoComplete="off"
                  value={wsQuery}
                  onChange={(e) => setWsQuery(e.target.value)}
                />
              </div>
              <h2>Workspaces</h2>
              <ul className="switcher-list" id="ws-menu-list">
                {matches.length ? (
                  matches.map((w) => (
                    <li key={w.id}>
                      <button
                        className="switcher-item"
                        aria-current={w.id === current?.id}
                        onClick={() => {
                          onSwitch(w.id);
                          setWsOpen(false);
                        }}
                      >
                        <span className="ico">
                          <Wmark workspace={w} size={28} />
                        </span>
                        <span className="name">{w.name}</span>
                        <svg className="check" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <use href="#i-check" />
                        </svg>
                      </button>
                    </li>
                  ))
                ) : null}
              </ul>
              {!matches.length ? (
                <p className="switcher-empty">{workspaces.length ? "No workspaces match that search." : "You have no workspaces yet."}</p>
              ) : null}

              <div className="ws-menu-actions">
                {/* digital-romanian-screens.html line 1230: data-open="create-ws"
                    opens a dialog, it does not navigate. The dialog itself owns
                    the delegated [data-open] listener, so these carry no
                    onClick — that is what the file does. onOpenCreateWs is kept
                    only so the caller's own state stays in step. */}
                <button type="button" className="create-site" data-open="create-ws" onClick={onOpenCreateWs}>
                  {icon("i-plus", 18)}
                  Create new workspace
                </button>
                {/* data-open="invite" with data-needs-ws, so it is hidden when
                    the account has no workspace. */}
                {!workspaces.length ? null : (
                  <button type="button" className="create-site" data-open="invite" data-needs-ws onClick={onOpenInvite}>
                    {icon("i-user-plus", 18)}
                    Invite member
                  </button>
                )}
                <Form method="post" action="/logout">
                  <button type="submit" className="create-site switcher-signout">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                      <path
                        d="M12 3.75H4.5A1.5 1.5 0 0 0 3 5.25v7.5A1.5 1.5 0 0 0 4.5 14.25H12M8.25 9h6.75M12.75 6.75 15 9l-2.25 2.25"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Sign out
                  </button>
                </Form>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {showAccount ? <Pmark name={userName} email={email} size={0} /> : null}
    </aside>
  );
}

/** The "open the menu" button the workspace shell shows on small screens. */
export function SidebarToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button className="menu-toggle" aria-label="Open menu" aria-controls="wsd-side" aria-expanded={open} onClick={onClick}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

/** closeMenu() in the standalone file: one Escape closes every open layer. */
export function useEscape(close: () => void) {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") ref.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

/** Keeps the chosen workspace across a full page load and across /workspace,
 *  /overview and /admin, which the standalone file does with a single
 *  in-memory `state.currentId`. */
export function usePersistentWorkspace(initial: string | null) {
  const KEY = "dr-current-workspace";
  const navigate = useNavigate();
  const [currentId, setCurrentId] = useState<string | null>(initial);

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY);
    if (stored && stored !== currentId) setCurrentId(stored);
    // Only on mount, deliberately: this restores the previous choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTo = (id: string) => {
    setCurrentId(id);
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      /* private mode; the state still holds for this render */
    }
  };

  return { currentId, switchTo, navigate };
}
