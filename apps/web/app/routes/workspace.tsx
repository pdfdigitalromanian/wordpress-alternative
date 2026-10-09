import { useEffect, useState } from "react";
import { useActionData, useLocation, useRouteLoaderData } from "react-router";
import { Toast } from "~/components/workspace-dialogs";
import { WorkspaceShell, useResultToast } from "~/components/workspace-shell";
import { handleWorkspaceAction } from "~/lib/workspace-actions.server";
import type { Route } from "./+types/workspace";
import type { loader as workspaceDataLoader } from "./workspace-data";

/* Ported from digital-romanian-screens.html ->
     <section data-route="/workspace" data-nested>
   and the sidebar destinations it links to (data-view="templates" / "team" /
   "settings"). This module is the pathless layout for the whole area, so the
   shell is mounted once and the four sections are children - that is what
   stops the sidebar and the workspace choice from being rebuilt (and the
   queries re-run) every time you click a nav row.

   Class names, copy and element order follow the standalone file. The only
   substitutions are its demo data for the signed-in user's real rows, and
   innerHTML renderers becoming React state. */

/* .wsd-nav, in source order. `to` drives aria-current, like renderChrome. */
export const VIEWS = [
  { key: "sites", to: "/workspace", label: "All sites", ico: "i-grid" },
  { key: "templates", to: "/templates", label: "Templates", ico: "i-template" },
  { key: "team", to: "/team", label: "Team", ico: "i-team" },
  { key: "settings", to: "/settings", label: "Settings", ico: "i-settings" },
] as const;

export async function action({ request }: Route.ActionArgs) {
  return handleWorkspaceAction(request, await request.formData());
}

export default function WorkspaceLayout() {
  /* Loaded once by the pathless routes/workspace-data.tsx layout, which also
     owns the shouldRevalidate that keeps tab clicks from re-reading it. */
  const data = useRouteLoaderData<typeof workspaceDataLoader>("routes/workspace-data")!;
  const actionResult = useActionData<typeof action>();
  const location = useLocation();
  const { currentId, switchTo } = useWorkspaceSelection(data);
  const { toast, setToast } = useResultToast(actionResult, null);

  return (
    <>
      <WorkspaceShell
        data={data}
        navItems={VIEWS.map((v) => ({ to: v.to, label: v.label, icon: v.ico, end: v.to === "/workspace" }))}
        activeKey={VIEWS.find((v) => v.to === location.pathname)?.label}
        currentId={currentId}
        switchTo={switchTo}
        actionResult={actionResult}
      />
      {toast ? (
        <Toast
          text={toast.text}
          {...(toast.label
            ? { link: { label: toast.label, onClick: () => { setToast(null); if (toast.href) window.location.assign(toast.href); } } }
            : {})}
        />
      ) : null}
    </>
  );
}

/** state.currentId in the standalone file, persisted so the choice survives a
 *  reload and is shared with the /overview and /admin screens. */
function useWorkspaceSelection(data: { workspaces: { id: string }[] }) {
  const [currentId, setCurrentId] = useState<string | null>(data.workspaces[0]?.id ?? null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("dr-current-workspace");
      if (stored && data.workspaces.some((w) => w.id === stored)) setCurrentId(stored);
    } catch {
      /* private mode: the in-memory choice still works */
    }
    // Restore the previous choice once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    currentId,
    switchTo: (id: string) => {
      setCurrentId(id);
      try {
        window.localStorage.setItem("dr-current-workspace", id);
      } catch {
        /* private mode */
      }
    },
  };
}
