import { useRef, useState } from "react";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/onboarding-profile";

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

/* The same screen serves two flows: step 1 of sign-up onboarding, and
   "Edit profile" from the account menu / team page. In onboarding, Continue
   and Skip advance to step 2 (workspace) - that sequence is sign-up only.
   When the route is opened with a ?returnTo=, it is an edit: both Continue and
   Skip hand control back there instead, so editing a profile never drags the
   user through workspace creation. */
function safeReturnTo(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw redirect("/login");

  /* Prefill from whatever the auth user already holds. The account menu's
     "Edit profile" link points here, so somebody who already set a name up
     during onboarding would otherwise be shown a blank form every time and
     have to retype it. user_metadata is the same source the avatar and the
     greeting read, so the form starts out showing what the rest of the app
     already displays. */
  const meta = user.user_metadata ?? {};
  return {
    email: user.email ?? "",
    name: String(meta.display_name ?? ""),
    username: String(meta.username ?? ""),
    photo: String(meta.avatar_url ?? ""),
    returnTo: safeReturnTo(new URL(request.url).searchParams.get("returnTo")),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));

  if (!name) return { error: "Add a display name so your team knows who you are." };

  const { supabase, headers } = createSupabaseServerClient(request);

  // There is no profiles table in the schema yet (workspaces,
  // workspace_memberships, sites, site_domains, pages, releases only), so the
  // profile is stored on the auth user for now. Moving it to a real profiles
  // table later does not change this screen.
  //
  // The photo is deliberately NOT persisted: user_metadata is copied into the
  // access-token JWT, and @supabase/ssr stores the session in cookies, so any
  // image bytes here blow the cookie/header size limits and lock the account
  // out. The picker below is a front-end-only preview until avatars move to
  // Supabase Storage. We also pin avatar_url to null so any legacy oversized
  // value is cleared on the next save.
  const { error } = await supabase.auth.updateUser({
    data: {
      display_name: name,
      username,
      avatar_url: null,
    },
  });

  if (error) return { error: "We couldn't save your profile. Try again in a moment." };

  /* updateUser() refreshes the session, so the new JWT - which carries the
     display_name in its user_metadata claim - arrives as a Set-Cookie header
     collected during the call above. Redirecting without those headers leaves
     the browser holding the previous token, whose user_metadata still has no
     display_name; landingFor() then reads that stale claim, decides the user
     has no profile and sends them straight back here. That is the loop that
     made the saved name not show up.

     Editing (returnTo set) goes back where the user came from; sign-up
     onboarding advances to step 2. */
  throw redirect(returnTo ?? "/onboarding/workspace", { headers });
}

export default function OnboardingProfile() {
  const actionData = useActionData<typeof action>();
  const { email, name: savedName, username: savedUsername, photo: savedPhoto, returnTo } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const editing = Boolean(returnTo);

  const fileInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  /* Seeded from the loader, so "Edit profile" from the account menu opens on
     the values already stored rather than an empty form. */
  const [name, setName] = useState(savedName);
  const [photo, setPhoto] = useState(savedPhoto);

  const letter = initials(name).slice(0, 1);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-inner onb">
          {editing ? null : <p className="onb-step">Step 1 of 2</p>}
          <h1 tabIndex={-1}>{editing ? "Edit profile" : "Set up your profile"}</h1>
          <p className="auth-lead">This is how teammates will see you across Digital Romanian.</p>

          <Form method="post" className="auth-form" noValidate>
            {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
            <div className="picker center">
              <label className="picker-mark">
                <span className="picker-face">
                  {photo ? (
                    <img src={photo} alt="" />
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
                  aria-label="Upload a profile photo"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setPhoto(String(reader.result ?? ""));
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              <div className="picker-copy">
                <strong>Profile photo</strong>
                <p>Add a photo, or we&apos;ll use your initials.</p>
                <button
                  type="button"
                  className="btn-text"
                  hidden={!photo}
                  onClick={() => {
                    setPhoto("");
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  Remove photo
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="profile-name">
                Display name <span className="req" aria-hidden="true">*</span>
              </label>
              <input
                id="profile-name"
                name="name"
                required
                autoComplete="name"
                className="auth-input"
                placeholder="e.g. Alex Radu"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </div>

            <div className="auth-field">
              <div className="field-row">
                <label htmlFor="profile-username">Username</label>
                <span className="opt">Optional</span>
              </div>
              <div className="input-group">
                <span className="prefix">@</span>
                <input id="profile-username" name="username" autoComplete="username" spellCheck={false} placeholder="alexradu" defaultValue={savedUsername} />
              </div>
            </div>

            <p role="alert" className="alert-error" hidden={!actionData?.error}>
              {actionData?.error ?? "Add a display name so your team knows who you are."}
            </p>

            <button type="submit" disabled={submitting} className="btn-primary auth-submit">{editing ? "Save changes" : "Continue"}</button>
          </Form>

          {/* Same element and classes as the standalone file: a type="button"
              outside the form, so skipping submits nothing. In onboarding it
              advances to step 2; when editing it returns to where the user
              came from. */}
          <button type="button" className="btn-text onb-skip" onClick={() => navigate(returnTo ?? "/onboarding/workspace")}>
            Skip for now
          </button>
        </div>
      </div>
    </main>
  );
}
