import { useEffect, useRef, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { componentConfig } from "~/lib/component-registry/config";
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

  return { page };
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
    const validation = validatePuckDocument(body.document, componentConfig);
    if (!validation.ok) {
      return Response.json({ error: `Invalid document: ${validation.error}` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("pages")
      .update({
        draft_document: body.document,
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

export default function PageEditor() {
  const { page } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "conflict" | "error" | "publishing" | "published">(
    "idle",
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const knownUpdatedAtRef = useRef(page.draft_updated_at);
  const latestDataRef = useRef<Data | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => setMounted(true), []);

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
      return;
    }
    if (result.error) {
      setStatus("error");
      setStatusMessage(result.error);
      return;
    }
    if (result.draftUpdatedAt) knownUpdatedAtRef.current = result.draftUpdatedAt;

    if (result.published) {
      setStatus("published");
      setStatusMessage("Published.");
      return;
    }
    if (result.publishError) {
      setStatus("error");
      setStatusMessage(`Draft saved, but publish failed: ${result.publishError}`);
      return;
    }
    setStatus("saved");
    setStatusMessage(null);
  }, [fetcher.state, fetcher.data]);

  function flush(intent: "autosave" | "publish" = "autosave") {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!latestDataRef.current) return;
    pendingRef.current = false;
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

  function handleChange(data: Data) {
    latestDataRef.current = data;
    pendingRef.current = true;
    setStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => flush("autosave"), AUTOSAVE_DEBOUNCE_MS);
  }

  // Flush any pending debounced save on unmount (e.g. the user clicks
  // "back" before the debounce timer fires) — otherwise the last edit
  // is silently lost rather than saved.
  useEffect(() => {
    return () => {
      if (pendingRef.current && debounceRef.current) {
        clearTimeout(debounceRef.current);
        if (latestDataRef.current) {
          fetcher.submit(
            {
              intent: "autosave",
              document: latestDataRef.current,
              knownUpdatedAt: knownUpdatedAtRef.current,
            } as unknown as Parameters<typeof fetcher.submit>[0],
            { method: "post", encType: "application/json" },
          );
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 text-sm dark:border-gray-800">
        <Link
          to={`/admin/sites/${page.site_id}`}
          className="hover:underline"
          onClick={() => {
            if (pendingRef.current) flush("autosave");
          }}
        >
          ← {page.title}
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-gray-600 dark:text-gray-400">
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
              flush("publish");
            }}
          >
            Publish site
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {mounted ? (
          <Puck
            config={componentConfig}
            data={page.draft_document as Data}
            onChange={handleChange}
            // Puck's own header renders a "Publish" button regardless of
            // whether this prop is supplied (verified: the click handler
            // is only a no-op — `onPublish && onPublish(data)` — when
            // this is omitted, but the button itself isn't conditionally
            // hidden). Wiring it to the same real flush+publish flow as
            // the status-bar button below means whichever one a user
            // clicks does the real thing — never an apparent no-op.
            onPublish={(data) => {
              latestDataRef.current = data;
              flush("publish");
            }}
          />
        ) : (
          <p className="p-4 text-sm text-gray-600 dark:text-gray-400">Loading editor…</p>
        )}
      </div>
    </div>
  );
}
