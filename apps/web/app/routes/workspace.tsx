import { useEffect, useState } from "react";
import { useActionData, useLoaderData, useLocation } from "react-router";
import { Toast } from "~/components/workspace-dialogs";
import { WorkspaceShell, useResultToast } from "~/components/workspace-shell";
import { handleWorkspaceAction } from "~/lib/workspace-actions.server";
import { loadWorkspaceScreen } from "~/lib/workspace.server";
import type { Route } from "./+types/workspace";

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

export async function loader({ request }: Route.LoaderArgs) {
  return loadWorkspaceScreen(request);
}

export async function action({ request }: Route.ActionArgs) {
  return handleWorkspaceAction(request, await request.formData());
}

/** Keep the shell (and its switcher, dialogs and open/closed drawer) alive
 *  across navigation between the four sections. The standalone file keeps
 *  everything in one `state` object for the same reason. Revalidation is still
 *  forced after a POST, so the grid and the activity feed update immediately
 *  after creating a site, publishing or inviting. */
const SECTION_PATHS = new Set(["/workspace", "/templates", "/team", "/teams", "/settings"]);

export function shouldRevalidate({ formMethod, nextUrl, currentUrl }: { formMethod?: string; nextUrl: URL; currentUrl: URL }) {
  // A submission has to refresh the grid and the activity feed.
  if (formMethod) return true;
  /* Moving between the four sections reads exactly the same rows -- the
     workspaces, sites and feed belong to the layout, not to the tab. The
     previous version only skipped revalidation when the path was *identical*,
     so every tab click fell through to the default (true) and re-ran the whole
     workspace loader, service-role user list included. That is the lag on
     Team / Templates / Settings. */
  if (SECTION_PATHS.has(currentUrl.pathname) && SECTION_PATHS.has(nextUrl.pathname)) return false;
  return true;
}

export default function WorkspaceLayout() {
  const data = useLoaderData<typeof loader>();
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
