import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Outlet } from "react-router";
import { SidebarToggle, WorkspaceSidebar, type SidebarNavItem } from "~/components/workspace-sidebar";
import { AccountMenu } from "~/components/account-menu";
import { CreateWorkspaceDialog, InviteDialog } from "~/components/workspace-dialogs";
import type { WorkspaceActionResult } from "~/lib/workspace-actions.server";
import type { WorkspaceScreenData } from "~/lib/workspace.server";

/* The .wsd shell from digital-romanian-screens.html, shared verbatim by
   /workspace (with Templates, Team and General settings as children) and by
   /admin, so the sidebar a user sees is literally the same component in both
   places.

   One thing is deliberately different from the standalone file: the mobile
   drawer flag lives here and is passed down. It used to be kept separately by
   both the shell and the sidebar, and two copies of one boolean can never stay
   in agreement - that is what made the menu button look broken. */

export type WorkspaceChrome = {
  data: WorkspaceScreenData;
  currentId: string | null;
  switchTo: (id: string) => void;
  openCreateWs: () => void;
  openInvite: () => void;
  /** The result of the last /workspace POST, for the dialogs to read. */
  actionResult: WorkspaceActionResult | undefined;
};

const ChromeContext = createContext<WorkspaceChrome | null>(null);

/** Lets a child route (or /admin) reuse the shell's switcher and dialogs
 *  without re-deriving any of that state. */
export function useWorkspaceChrome() {
  const value = useContext(ChromeContext);
  if (!value) throw new Error("useWorkspaceChrome must be used inside a WorkspaceShell");
  return value;
}

export function WorkspaceShell({
  data,
  navItems,
  activeKey,
  currentId,
  switchTo,
  onOpenCreateWs,
  onOpenInvite,
  actionResult,
  children,
  topRight,
  contentClassName = "wsd-main",
}: {
  data: WorkspaceScreenData;
  navItems: SidebarNavItem[];
  /** Highlights a nav row that is not a plain Router link. */
  activeKey?: string;
  currentId: string | null;
  switchTo: (id: string) => void;
  /** Override when the host route needs to run something extra first. */
  onOpenCreateWs?: () => void;
  onOpenInvite?: () => void;
  actionResult?: WorkspaceActionResult;
  /** Omitted for the layout case, where <Outlet/> is rendered instead. */
  children?: React.ReactNode;
  topRight?: React.ReactNode;
  contentClassName?: string;
}) {
  const [sideOpen, setSideOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const current = data.workspaces.find((w) => w.id === currentId) ?? data.workspaces[0];

  const chrome = useMemo<WorkspaceChrome>(
    () => ({
      data,
      currentId: current?.id ?? null,
      switchTo,
      openCreateWs: () => setCreateOpen(true),
      openInvite: () => setInviteOpen(true),
      actionResult,
    }),
    [data, current?.id, switchTo, actionResult],
  );

  return (
    <ChromeContext.Provider value={chrome}>
      <div className="wsd">
        <WorkspaceSidebar
          data={data}
          navItems={navItems}
          activeKey={activeKey}
          currentId={current?.id ?? null}
          onSwitch={switchTo}
          onOpenCreateWs={() => {
            onOpenCreateWs?.();
            setCreateOpen(true);
            setSideOpen(false);
          }}
          onOpenInvite={() => {
            onOpenInvite?.();
            setInviteOpen(true);
            setSideOpen(false);
          }}
          open={sideOpen}
          onClose={() => setSideOpen(false)}
        />

        <div className="wsd-body">
          <header className="wsd-top">
            <SidebarToggle open={sideOpen} onClick={() => setSideOpen((o) => !o)} />
            <span className="spacer" />
            {topRight ?? (
              <>
                <button className="icon-btn" aria-label="Notifications">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <use href="#i-bell" />
                  </svg>
                </button>
                <AccountMenu name={data.userName} email={data.email} />
              </>
            )}
          </header>

          <main className={contentClassName} id="wsd-main">
            <div className="wsd-inner" id="wsd-view">
              {children ?? <Outlet />}
            </div>
          </main>
        </div>

        <div className={`scrim${sideOpen ? " show" : ""}`} id="wsd-scrim" onClick={() => setSideOpen(false)} />

        <CreateWorkspaceDialog open={createOpen} onClose={() => setCreateOpen(false)} actionResult={actionResult} />
        <InviteDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          workspace={current}
          knownPeople={data.directory}
          actionResult={actionResult}
        />
      </div>
    </ChromeContext.Provider>
  );
}

/** The toast plus the dialogs the standalone file opens after an action.
 *  Returns a plain object so both /workspace and /admin can use it. */
export function useResultToast(actionResult: WorkspaceActionResult | undefined, extraToast: string | null) {
  const [toast, setToast] = useState<{ text: string; label?: string; href?: string } | null>(null);
  const seen = useRef<unknown>(null);

  useEffect(() => {
    if (extraToast) setToast({ text: extraToast });
    else if (actionResult && actionResult !== seen.current) {
      seen.current = actionResult;
      if ("created" in actionResult) {
        // toast(`${w.name} workspace created`, { label: 'Invite member' }) or
        // toast(`${s.name} created`, { label: 'Open' })
        const workspaceCreated = Boolean(actionResult.workspaceId) && !("siteName" in actionResult);
        setToast(
          workspaceCreated
            ? { text: `${actionResult.created} workspace created`, label: "Invite member" }
            : { text: `${actionResult.created} created`, label: "Open", href: "/overview" },
        );
      } else if ("invited" in actionResult) {
        const who = actionResult.invited > 1 ? `${actionResult.invited} people` : actionResult.emails[0];
        const note = actionResult.siteRolesNotStored ? " (site-specific roles aren't persisted yet)" : "";
        setToast({ text: `Invite sent to ${who} as ${actionResult.role}${note}`, label: "Preview invite", href: "/invitation" });
      } else if (actionResult && "siteName" in actionResult && actionResult.siteName) {
        setToast({ text: `${actionResult.siteName} deleted` });
      } else if ("error" in actionResult && actionResult.error) {
        // Without this branch a failed action was silent: the forms below have
        // no inline error slot, so "Create new site" looked like a dead button
        // rather than a rejected request.
        setToast({ text: actionResult.error });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionResult, extraToast]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(t);
  }, [toast]);

  return { toast, setToast };
}
