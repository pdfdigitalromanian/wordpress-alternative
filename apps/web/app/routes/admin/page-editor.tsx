import { useEffect, useRef, useState } from "react";
import { Link, useFetcher, useLoaderData } from "react-router";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { componentConfig } from "~/lib/component-registry/config";
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
  return { page };
}

type AutosaveBody = { intent: "autosave"; document: Data; knownUpdatedAt: string };

export async function action({ request, params }: Route.ActionArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as AutosaveBody;

  if (body.intent !== "autosave") {
    return Response.json({ error: "Unknown action" }, { status: 400 });
  }

  // Optimistic concurrency (Part A SS5): only write if nobody else's save
  // has landed since this client last knew the draft's state.
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
  return Response.json({ draftUpdatedAt: data.draft_updated_at });
}

const AUTOSAVE_DEBOUNCE_MS = 800;

export default function PageEditor() {
  const { page } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "conflict">("idle");
  const knownUpdatedAtRef = useRef(page.draft_updated_at);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.conflict) {
      setStatus("conflict");
      return;
    }
    if (fetcher.data.draftUpdatedAt) {
      knownUpdatedAtRef.current = fetcher.data.draftUpdatedAt;
      setStatus("saved");
    }
  }, [fetcher.state, fetcher.data]);

  function handleChange(data: Data) {
    setStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // `Data`'s slot fields are typed as render-time components, which
      // makes the object not structurally a `JsonValue` to TS even though
      // Puck itself only ever puts plain serializable arrays there — cast
      // through `unknown` rather than weakening the shared `Data` type.
      const payload = { intent: "autosave", document: data, knownUpdatedAt: knownUpdatedAtRef.current };
      fetcher.submit(payload as unknown as Parameters<typeof fetcher.submit>[0], {
        method: "post",
        encType: "application/json",
      });
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 text-sm dark:border-gray-800">
        <Link to={`/admin/sites/${page.site_id}`} className="hover:underline">
          ← {page.title}
        </Link>
        <span className="text-gray-600 dark:text-gray-400">
          {status === "saving" && "Saving…"}
          {status === "saved" && "Draft saved"}
          {status === "conflict" && "Someone else saved a newer version — reload this page"}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {mounted ? (
          <Puck
            config={componentConfig}
            data={page.draft_document as Data}
            onChange={handleChange}
            // The editor's own Publish button isn't used — publishing a
            // *site* (all its pages at once, atomically) happens from the
            // site page via publish_site(), not per-page here.
            onPublish={() => {}}
          />
        ) : (
          <p className="p-4 text-sm text-gray-600 dark:text-gray-400">Loading editor…</p>
        )}
      </div>
    </div>
  );
}
