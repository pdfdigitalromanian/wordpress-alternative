import { Outlet } from "react-router";
import { loadWorkspaceScreen } from "~/lib/workspace.server";
import type { Route } from "./+types/workspace-data";

/* Pathless layout above both workspace areas: the section tree the
   WorkspaceShell owns (/workspace, /templates, /team, /settings) and the site
   Overview screen, which draws its own shell but reads exactly the same rows.
   Loading once here is what makes moving between the two -- clicking a site
   card, or "All sites" in the overview sidebar -- a single client-side
   transition instead of a second read of the same workspaces, members and
   sites (auth.getUser + memberships + colleagues + sites each ran again). */
export async function loader({ request }: Route.LoaderArgs) {
  return loadWorkspaceScreen(request);
}

const WORKSPACE_AREA = new Set(["/workspace", "/templates", "/template", "/team", "/teams", "/settings"]);
function inWorkspaceArea(pathname: string) {
  return WORKSPACE_AREA.has(pathname) || pathname.startsWith("/overview");
}

/** Every screen under this layout reads the same layout-level rows, so a
   client-side move between them must not re-run the loader. A POST still
   revalidates, so a new site / invite shows up immediately. */
export function shouldRevalidate({ formMethod, nextUrl, currentUrl }: { formMethod?: string; nextUrl: URL; currentUrl: URL }) {
  if (formMethod) return true;
  if (inWorkspaceArea(currentUrl.pathname) && inWorkspaceArea(nextUrl.pathname)) return false;
  return true;
}

export default function WorkspaceDataLayout() {
  return <Outlet />;
}
