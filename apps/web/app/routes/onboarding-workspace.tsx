import { useRef, useState } from "react";
import { Form, redirect, useActionData, useNavigation } from "react-router";
import { slugify } from "~/lib/slugify";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/onboarding-workspace";

const PURPOSES = [
  { label: "Client sites", icon: "i-website", w: 16, h: 16 },
  { label: "My business", icon: "i-store", w: 16, h: 16 },
  { label: "Online shop", icon: "i-shop", w: 30, h: 26 },
  { label: "Blog", icon: "i-blog", w: 30, h: 28 },
];

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw redirect("/login");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = String(formData.get("wsname") ?? "").trim();
  const slug = slugify(String(formData.get("wsslug") ?? ""));

  if (!name) return { error: "Add a workspace name to continue." };
  if (!slug) return { error: "Add a workspace URL to continue." };

  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw redirect("/login");

  const { data: created, error: insertError } = await supabase
    .from("workspaces")
    .insert({ name, slug, created_by: user.id } as never)
    .select("id")
    .single();

  if (insertError || !created) {
    return { error: "We couldn't create that workspace. Try a different name or URL." };
  }

  // The "What's it for?" answer is collected and shown, but not stored:
  // workspace_memberships has no purpose column yet (same gap as the
  // workspace logo). It stays on the form so the screen matches the design.
  const { error: memberError } = await supabase
    .from("workspace_memberships")
    .insert({ workspace_id: created.id, user_id: user.id, role: "owner" } as never);

  if (memberError) {
    return { error: "We couldn't finish setting up that workspace. Try again in a moment." };
  }

  throw redirect("/workspace");
}

export default function OnboardingWorkspace() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [logo, setLogo] = useState("");

  const letter = initials(name).slice(0, 1);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-inner onb">
          <p className="onb-step">Step 2 of 2</p>
          <h1 tabIndex={-1}>Create your workspace</h1>
          <p className="auth-lead">Where your sites and team live.</p>

          <Form method="post" className="auth-form" noValidate>
            <div className="picker square">
              <label className="picker-mark">
                <span className="picker-face">
                  {logo ? (
                    <img src={logo} alt="" />
                  ) : letter ? (
                    letter
                  ) : (
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true"><use href="#i-image" /></svg>
                  )}
                </span>
                <span className="picker-badge" aria-hidden="true">
                  <svg width={14} height={14} viewBox="0 0 16 16"><use href="#i-pencil" /></svg>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInput}
                  aria-label="Upload a workspace logo"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setLogo(String(reader.result ?? ""));
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              <div className="picker-copy">
                <strong>Logo</strong>
                <p>Optional</p>
                <button
                  type="button"
                  className="btn-text"
                  hidden={!logo}
                  onClick={() => {
                    setLogo("");
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  Remove logo
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="onb-ws-name">
                Workspace name <span className="req" aria-hidden="true">*</span>
              </label>
              <input
                id="onb-ws-name"
                name="wsname"
                required
                maxLength={48}
                className="auth-input"
                placeholder="e.g. Nova Studio or Acme Clients"
                autoComplete="organization"
                value={name}
                onChange={(event) => {
                  setName(event.currentTarget.value);
                  if (!slugEdited) setSlug(slugify(event.currentTarget.value));
                }}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="onb-ws-slug">Workspace URL</label>
              <div className="input-group">
                <span className="prefix">app.digitalromanian.ro/</span>
                <input
                  id="onb-ws-slug"
                  name="wsslug"
                  spellCheck={false}
                  placeholder="your-workspace"
                  value={slug}
                  onChange={(event) => {
                    setSlugEdited(true);
                    setSlug(event.currentTarget.value);
                  }}
                />
              </div>
            </div>

            <fieldset className="purpose auth-field">
              <legend>
                <span className="field-row">
                  <span>What&apos;s it for?</span>
                  <span className="opt">Optional</span>
                </span>
              </legend>
              <div className="purpose-grid">
                {PURPOSES.map((purpose) => (
                  <label className="ptile" key={purpose.label}>
                    <input type="radio" name="wspurpose" value={purpose.label} />
                    <span className="pic">
                      <svg width={purpose.w} height={purpose.h} viewBox={`0 0 ${purpose.w} ${purpose.h}`} fill="none" aria-hidden="true">
                        <use href={`#${purpose.icon}`} />
                      </svg>
                    </span>
                    <span className="plabel">{purpose.label}</span>
                    <svg className="pcheck" width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden="true"><use href="#i-check" /></svg>
                  </label>
                ))}
              </div>
            </fieldset>

            <p role="alert" className="alert-error" hidden={!actionData?.error}>{actionData?.error ?? ""}</p>

            <button type="submit" disabled={submitting} className="btn-primary auth-submit">Create workspace</button>
          </Form>

          <a className="btn-text onb-skip" href="/workspace">Skip for now</a>
        </div>
      </div>
    </main>
  );
}
