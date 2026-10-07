import { useMemo, useState } from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { useWorkspaceChrome } from "~/components/workspace-shell";
import { handleWorkspaceAction } from "~/lib/workspace-actions.server";
import { timeAgo } from "~/lib/workspace-view";
import type { SiteRow } from "~/lib/workspace.server";
import type { Route } from "./+types/workspace-sites";

/* renderDashboard -> renderSites -> renderSiteGrid, from
   digital-romanian-screens.html, with every handler in its <script> turned
   into a real action: create website, the three stat filters, the search box,
   the per-site "more" menu (Open / Publish / Delete) and the activity feed. */

const icon = (id: string, w = 16, h = w, vb = `0 0 ${w} ${h}`) => (
  <svg width={w} height={h} viewBox={vb} fill="none" aria-hidden="true">
    <use href={`#${id}`} />
  </svg>
);

/* THEME_TEXT / STATUS, from the standalone file's script. */
const THEME_TEXT: Record<string, string> = {
  alicia: "Nature's essence for a vibrant life",
  nova: "Accelerate your digital transformation",
  axis: "Designing your digital future",
  sun: "Spring collection now live",
  plain: "Untitled site",
};

const STATUS: Record<string, [string, string]> = {
  published: ["Published", "var(--published)"],
  draft: ["In draft", "var(--draft)"],
  unpublished: ["Not published", "var(--idle)"],
};

export async function action({ request }: Route.ActionArgs) {
  return handleWorkspaceAction(request, await request.formData());
}

export default function WorkspaceSites() {
  const { data, currentId, openCreateWs } = useWorkspaceChrome();
  const actionResult = useActionData<typeof action>();
  const navigation = useNavigation();
  const [siteFilter, setSiteFilter] = useState<"all" | "draft" | "published">("all");
  const [siteQuery, setSiteQuery] = useState("");
  const [moreOpen, setMoreOpen] = useState<string | null>(null);

  const creating = navigation.state === "submitting" && navigation.formData?.get("intent") === "create-site";

  /* Delete used to be a plain POST: the menu stayed open and the card sat there
     until the action round-tripped *and* the whole workspace loader re-ran, which
     read as "the button did nothing" for seconds. Track the in-flight delete from
     useNavigation and drop the card straight away; React Router puts it back if
     the action comes back with an error. */
  const deleting =
    navigation.state !== "idle" && navigation.formData?.get("intent") === "delete-site"
      ? String(navigation.formData.get("siteId") ?? "")
      : null;
  const first = data.userName.split(" ")[0];
  const current = data.workspaces.find((w) => w.id === currentId);

  /* Every hook has to run on every render, so this is above the "no workspace
     yet" early return below. Calling useMemo after that return made React throw
     "Rendered more hooks than during the previous render" the moment the
     selected workspace resolved, which took the whole grid -- and the create
     buttons in it -- down with it. */
  const list = useMemo(() => {
    const q = siteQuery.trim().toLowerCase();
    return (current?.sites ?? []).filter((s) => {
      const byFilter =
        siteFilter === "all" || (siteFilter === "published" ? s.status === "published" : s.status !== "published");
      return byFilter && (!q || s.name.toLowerCase().includes(q));
    });
  }, [current, siteFilter, siteQuery]);

  // renderDashboard: no workspace yet.
  if (!current) {
    return (
      <>
        <p className="eyebrow">Welcome{first ? `, ${first}` : ""}</p>
        <div className="wsd-head">
          <div>
            <h1 tabIndex={-1}>You&apos;re not in a workspace yet</h1>
          </div>
        </div>
        <div className="empty">
          <h2>Create a workspace to start building sites</h2>
          <p>Your sites, templates and teammates live inside a workspace. If someone invites you to theirs, it shows up in the workspace switcher.</p>
          <div className="row">
            <button className="btn-dark" onClick={openCreateWs}>
              {icon("i-plus", 18)}
              Create workspace
            </button>
          </div>
        </div>
      </>
    );
  }

  const pub = current.sites.filter((s) => s.status === "published").length;

  const stat = (key: "all" | "draft" | "published", label: string, n: number, ico: string, vb?: string) => (
    <button className="stat" aria-pressed={siteFilter === key} onClick={() => setSiteFilter(key)}>
      <span className="ic">{vb ? icon(ico, 16, 16, vb) : icon(ico, 16)}</span>
      <span className="txt">
        <small>{label}</small>
        <strong>{n}</strong>
      </span>
      {icon("i-chevron-right", 18, 17)}
    </button>
  );

  const resetFilters = () => {
    setSiteFilter("all");
    setSiteQuery("");
  };

  return (
    <>
      <div className="wsd-head">
        <div>
          <p className="eyebrow">Welcome back, {first}</p>
          <h1 tabIndex={-1}>{current.name}</h1>
          <p>Manage your websites, create new ones, and access helpful resources to get the most out of Digital Romanian.</p>
        </div>
        <div className="wsd-tools">
          <div className="search-box">
            {icon("i-search", 16, 16, "0 0 16 16")}
            <label className="sr-only" htmlFor="site-search">
              Search websites
            </label>
            <input
              id="site-search"
              type="search"
              placeholder="Search website"
              autoComplete="off"
              value={siteQuery}
              onChange={(e) => setSiteQuery(e.target.value)}
            />
          </div>
          {/* [data-new-site] in the standalone file. */}
          <Form method="post">
            <input type="hidden" name="intent" value="create-site" />
            <input type="hidden" name="workspaceId" value={current.id} />
            <button type="submit" className="btn-dark" data-new-site disabled={creating}>
              {icon("i-plus", 18)}
              <span>
                Create new <span className="long">website</span>
              </span>
            </button>
          </Form>
        </div>
      </div>

      <div className="stats">
        {stat("all", "Total websites", current.sites.length, "i-website", "0 0 16 16")}
        {stat("draft", "Draft", current.sites.length - pub, "i-content", "0 0 16 19")}
        {stat("published", "Published", pub, "i-publishing", "0 0 16 16")}
      </div>

      <div className="sec-head">
        <div>
          <h2>Your websites</h2>
          <p>Build something new. Pick up where you left off.</p>
        </div>
        <button type="button" className="link-more" onClick={resetFilters}>
          View all {icon("i-arrow-right", 18, 18, "0 0 16 16")}
        </button>
      </div>

      <div className="sites" id="site-grid">
        {/* The grid tile is [data-new-site] too, and runs the same action. */}
        <Form method="post">
          <input type="hidden" name="intent" value="create-site" />
          <input type="hidden" name="workspaceId" value={current.id} />
          <button type="submit" className="site-new" data-new-site disabled={creating}>
            <span className="plus">{icon("i-plus", 18)}</span>
            <strong>Create new site</strong>
            <span>Start from scratch or use a template</span>
          </button>
        </Form>

        {list
          .filter((s) => s.id !== deleting)
          .map((s) => (
            <SiteCard key={s.id} site={s} moreOpen={moreOpen === s.id} setMoreOpen={setMoreOpen} />
          ))}

        {!list.length && (siteQuery || siteFilter !== "all") ? (
          <p className="empty-inline">
            No websites match.{" "}
            <button type="button" className="btn-text" onClick={resetFilters}>
              Show all websites
            </button>
          </p>
        ) : null}
      </div>

      <section className="activity" aria-labelledby="act-title">
        <div className="activity-head">
          {icon("i-clock", 16, 16, "0 0 16 16")}
          <h2 id="act-title">Recent activities</h2>
          <Link className="link-more" to="/workspace">
            View all {icon("i-arrow-right", 12, 12, "0 0 16 16")}
          </Link>
        </div>
        <ul>
          {current.activity
            .slice()
            .sort((a, b) => b.time - a.time)
            .slice(0, 4)
            .map((a) => (
              <li key={a.id}>
                <span className="ic">{icon(a.kind === "invite" ? "i-send" : a.kind === "create" ? "i-plus" : "i-clock", 16)}</span>
                <div>
                  <strong>{a.text}</strong>
                  <small>{timeAgo(a.time)}</small>
                </div>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}

function SiteCard({
  site,
  moreOpen,
  setMoreOpen,
}: {
  site: SiteRow;
  moreOpen: boolean;
  setMoreOpen: (v: string | null) => void;
}) {
  return (
    <article className="site">
      <Link className="site-open" to="/overview" aria-label={`Open ${site.name}`} />
      <div className={`thumb t-${site.theme}`} aria-hidden="true">
        <b>{THEME_TEXT[site.theme] ?? THEME_TEXT.plain}</b>
        <i />
      </div>
      <h3 className="site-name">{site.name}</h3>
      <p className="site-status">
        <span className="dot" style={{ "--c": STATUS[site.status]?.[1] ?? "var(--idle)" } as React.CSSProperties} />
        {STATUS[site.status]?.[0] ?? "Not published"} {icon("i-external", 12, 12, "0 0 16 16")}
      </p>
      <div className="site-foot">
        <span>Updated {site.updated ? timeAgo(new Date(site.updated).getTime()).toLowerCase() : "just now"}</span>
        <button
          className="more-btn"
          aria-label={`More actions for ${site.name}`}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(moreOpen ? null : site.id)}
        >
          {icon("i-more", 16, 16, "0 0 16 16")}
        </button>
      </div>

      {moreOpen ? (
        <div className="more-menu" id={`more-${site.id}`}>
          <Link to="/overview">Open site</Link>
          {/* [data-status] and [data-delete] in the standalone file. */}
          <Form method="post">
            <input type="hidden" name="intent" value={site.status === "published" ? "unpublish" : "publish"} />
            <input type="hidden" name="siteId" value={site.id} />
            <button type="submit">{site.status === "published" ? "Unpublish" : "Publish"}</button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="delete-site" />
            <input type="hidden" name="siteId" value={site.id} />
            <button type="submit" className="danger">
              Delete site
            </button>
          </Form>
        </div>
      ) : null}
    </article>
  );
}
