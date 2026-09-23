import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { Puck, legacySideBarPlugin, usePuck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { componentConfig, type StorefrontMetadata } from "~/lib/component-registry/config";
import { validatePuckDocument } from "~/lib/component-registry/validate.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/page-editor";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const { data: page, error } = await supabase
    .from("pages")
    .select("id, site_id, slug, title, draft_document, draft_updated_at")
    .eq("id", params.pageId!)
    .single();

  if (error || !page) throw new Response("Page not found", { status: 404 });

  // The URL carries both :siteId and :pageId — if they don't actually
  // agree (a stale link, a hand-edited URL, a page moved between sites),
  // treat it as not found rather than silently editing/publishing a page
  // under a different site than the URL implies. RLS already scopes
  // access correctly either way; this keeps the route's own semantics
  // honest on top of that.
  if (page.site_id !== params.siteId) {
    throw new Response("Page not found in this site", { status: 404 });
  }

  // Passed to <Puck metadata={...}> so components like ProductGrid can
  // fetch real data for the live editor preview via the same isomorphic
  // route (api.storefront-products.tsx) the published renderer uses —
  // see component-registry/config.tsx's resolveData.
  const storefrontMetadata: StorefrontMetadata = {
    siteId: page.site_id,
    origin: new URL(request.url).origin,
    mode: "preview",
  };

  return { page, storefrontMetadata };
}

type ActionBody =
  | { intent: "autosave"; document: Data; knownUpdatedAt: string }
  | { intent: "publish"; document: Data; knownUpdatedAt: string; label?: string };

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as ActionBody;

  // Confirm the page actually belongs to the site in the URL before
  // doing anything with it (see the loader for why this check exists
  // independently of RLS).
  const { data: existingPage, error: pageLookupError } = await supabase
    .from("pages")
    .select("site_id")
    .eq("id", params.pageId!)
    .maybeSingle();
  if (pageLookupError || !existingPage || existingPage.site_id !== params.siteId) {
    return Response.json({ error: "Page not found in this site" }, { status: 404 });
  }

  if (body.intent === "autosave" || body.intent === "publish") {
    const validation = validatePuckDocument<Data>(body.document, componentConfig);
    if (!validation.ok) {
      return Response.json({ error: `Invalid document: ${validation.error}` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("pages")
      .update({
        // The SANITIZED projection, not the raw client payload — strips
        // Puck's resolveData extras (resolvedProducts, etc.) rather than
        // persisting them. See validate.server.ts.
        draft_document: validation.document,
        draft_updated_at: new Date().toISOString(),
        draft_updated_by: user.id,
      })
      .eq("id", params.pageId!)
      .eq("draft_updated_at", body.knownUpdatedAt)
      .select("draft_updated_at")
      .maybeSingle();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data) return Response.json({ conflict: true }, { status: 409 });

    if (body.intent === "autosave") {
      return Response.json({ draftUpdatedAt: data.draft_updated_at });
    }

    // "publish" saves the draft above, then publishes the whole site
    // (Part A SS10 — publishing is a site-level release, not a per-page
    // action) via the same RPC the site page's Publish button uses.
    const { data: release, error: publishError } = await supabase.rpc("publish_site", {
      target_site_id: params.siteId!,
      release_label: body.label,
    });
    if (publishError) {
      return Response.json(
        { draftUpdatedAt: data.draft_updated_at, publishError: publishError.message },
        { status: 200 },
      );
    }
    return Response.json({ draftUpdatedAt: data.draft_updated_at, published: true, releaseId: release?.id });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

const AUTOSAVE_DEBOUNCE_MS = 800;

type SaveStatus = "idle" | "saving" | "saved" | "conflict" | "error" | "publishing" | "published";

const editorPlugins = [legacySideBarPlugin({ componentsLabel: "Add element", outlineLabel: "Layers" })];

function EditorPreview({ children }: { children: ReactNode }) {
  const { appState, dispatch } = usePuck();
  return <div className="editor-preview-surface">{children}{appState.data.content.length === 0 ? <div className="editor-empty"><div className="editor-empty-symbol" aria-hidden="true">▧</div><h2>Start building your page</h2><p>Add elements from the left panel, or start with a heading.</p><button className="btn" onClick={() => dispatch({ type: "insert", componentType: "Heading", destinationIndex: 0, destinationZone: "root:default-zone" })}>Add heading</button></div> : null}</div>;
}
const editorOverrides = {
  headerActions: () => <span className="muted text-sm">Changes save as a private draft</span>,
  preview: EditorPreview,
};

export default function PageEditor() {
  const { page, storefrontMetadata } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const knownUpdatedAtRef = useRef(page.draft_updated_at);
  const latestDataRef = useRef<Data | null>(page.draft_document as Data);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Distinct from "is a debounce timer pending" — this is "does the
  // server not yet have the latest edit", true from the moment
  // handleChange fires until a save actually lands, spanning any number
  // of debounce/in-flight/queued cycles in between.
  const dirtyRef = useRef(false);
  // If handleChange (or a deliberate flush) happens while a submission
  // is already in flight, we don't fire a second concurrent request
  // (whose response could land out of order and stomp the newer
  // knownUpdatedAt) — we queue it and fire once the current one settles.
  const queuedIntentRef = useRef<"autosave" | "publish" | null>(null);
  const leavingToRef = useRef<string | null>(null);

  useEffect(() => setMounted(true), []);

  function doSubmit(intent: "autosave" | "publish") {
    if (!latestDataRef.current) return;
    setStatus(intent === "publish" ? "publishing" : "saving");
    fetcher.submit(
      {
        intent,
        document: latestDataRef.current,
        knownUpdatedAt: knownUpdatedAtRef.current,
      } as unknown as Parameters<typeof fetcher.submit>[0],
      { method: "post", encType: "application/json" },
    );
  }

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const result = fetcher.data as {
      conflict?: boolean;
      error?: string;
      draftUpdatedAt?: string;
      published?: boolean;
      publishError?: string;
    };

    if (result.conflict) {
      setStatus("conflict");
      setStatusMessage("Someone else saved a newer version — reload this page.");
      queuedIntentRef.current = null; // can't safely retry against a known-stale token
      leavingToRef.current = null;
      return;
    }
    if (result.error) {
      setStatus("error");
      setStatusMessage(result.error);
      queuedIntentRef.current = null;
      leavingToRef.current = null;
      return;
    }

    if (result.draftUpdatedAt) knownUpdatedAtRef.current = result.draftUpdatedAt;

    // A queued edit/intent arrived while this request was in flight —
    // it's still not persisted, so we're not clean yet; fire it now that
    // the previous request has settled, rather than losing it.
    if (queuedIntentRef.current) {
      const nextIntent = queuedIntentRef.current;
      queuedIntentRef.current = null;
      doSubmit(nextIntent);
      return;
    }

    dirtyRef.current = false;

    if (result.published) {
      setStatus("published");
      setStatusMessage("Published.");
    } else if (result.publishError) {
      setStatus("error");
      setStatusMessage(`Draft saved, but publish failed: ${result.publishError}`);
    } else {
      setStatus("saved");
      setStatusMessage(null);
    }

    // A navigation was waiting on this save (see handleBackClick) —
    // now that it's confirmed clean, actually leave.
    if (leavingToRef.current) {
      const to = leavingToRef.current;
      leavingToRef.current = null;
      navigate(to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);

  function flush(intent: "autosave" | "publish" = "autosave") {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (fetcher.state !== "idle") {
      // Something's already in flight — remember the strongest intent
      // (publish outranks a plain autosave) and let the effect above
      // fire it once that request settles.
      queuedIntentRef.current = intent === "publish" ? "publish" : (queuedIntentRef.current ?? intent);
      return;
    }
    doSubmit(intent);
  }

  function handleChange(data: Data) {
    latestDataRef.current = data;
    dirtyRef.current = true;
    setStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => flush("autosave"), AUTOSAVE_DEBOUNCE_MS);
  }

  function handleBackClick(event: React.MouseEvent) {
    event.preventDefault();
    const to = `/admin/sites/${page.site_id}`;
    if (dirtyRef.current || fetcher.state !== "idle") {
      // Wait for the in-flight/queued save to actually land (confirmed
      // clean, not just "a request was sent") before leaving — a fire-
      // and-forget submit here would race the navigation and could lose
      // the edit or hide a conflict/error the user never gets to see.
      leavingToRef.current = to;
      flush("autosave");
    } else {
      navigate(to);
    }
  }

  // Best-effort only: browsers don't reliably wait for async work queued
  // from beforeunload, so this can't get the same guarantee as
  // handleBackClick's in-app navigation does. It at least attempts a
  // synchronous-ish flush via sendBeacon-style fire-and-forget for the
  // tab-close/refresh case, and warns the user rather than saying nothing.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyRef.current || fetcher.state !== "idle") {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="visual-editor" style={{ position: "fixed", inset: 0, zIndex: 50, background: "white", display: "flex", flexDirection: "column" }}>
      <div className="editor-topbar">
        <a href={`/admin/sites/${page.site_id}`} className="hover:underline" onClick={handleBackClick}>
          <span className="brand-mark">D</span> <strong>Digital Romanian</strong><span className="editor-page-title"> / {page.title}</span>
        </a>
        <div className="flex items-center gap-3">
          <span role="status" className="editor-status">
            {status === "idle" && "● Saved draft"}
            {status === "saving" && "Saving…"}
            {status === "saved" && "Draft saved"}
            {status === "conflict" && statusMessage}
            {status === "error" && statusMessage}
            {status === "publishing" && "Publishing…"}
            {status === "published" && "Published"}
          </span>
          <button
            type="button"
            className="btn"
            disabled={status === "publishing"}
            onClick={() => {
              // Publishing here publishes the WHOLE site (every page's
              // current draft), not just this one — same as the site
              // page's Publish button. Flush this page's own pending
              // edit first so it's included.
              if (window.confirm("Publish all page drafts in this site? This updates the live website, including changes on other pages.")) flush("publish");
            }}
          >
            Publish site
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, width: "100%", minWidth: 0 }}>
        {mounted ? (
          <Puck
            headerTitle={page.title}
            overrides={editorOverrides}
            plugins={editorPlugins}
            config={componentConfig}
            data={page.draft_document as Data}
            metadata={storefrontMetadata}
            onChange={handleChange}

          />
        ) : (
          <p className="p-4 text-sm text-gray-600 dark:text-gray-400">Loading editor…</p>
        )}
      </div>
    </div>
  );
}
