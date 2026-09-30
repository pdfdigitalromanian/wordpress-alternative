import { useRef, useState } from "react";
import { Form, redirect, useActionData, useNavigate, useNavigation } from "react-router";
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

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw redirect("/login");
  return { email: user.email ?? "" };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const photo = String(formData.get("photo") ?? "");

  if (!name) return { error: "Add a display name so your team knows who you are." };

  const { supabase } = createSupabaseServerClient(request);

  // There is no profiles table in the schema yet (workspaces,
  // workspace_memberships, sites, site_domains, pages, releases only), so the
  // profile is stored on the auth user for now. Moving it to a real profiles
  // table later does not change this screen.
  const { error } = await supabase.auth.updateUser({
    data: {
      display_name: name,
      username,
      avatar_url: photo || null,
    },
  });

  if (error) return { error: "We couldn't save your profile. Try again in a moment." };

  throw redirect("/onboarding/workspace");
}

export default function OnboardingProfile() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const fileInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");

  const letter = initials(name).slice(0, 1);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-inner onb">
          <p className="onb-step">Step 1 of 2</p>
          <h1 tabIndex={-1}>Set up your profile</h1>
          <p className="auth-lead">This is how teammates will see you across Digital Romanian.</p>

          <Form method="post" className="auth-form" noValidate>
            <input type="hidden" name="photo" value={photo} />

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
                <input id="profile-username" name="username" autoComplete="username" spellCheck={false} placeholder="alexradu" />
              </div>
            </div>

            <p role="alert" className="alert-error" hidden={!actionData?.error}>
              {actionData?.error ?? "Add a display name so your team knows who you are."}
            </p>

            <button type="submit" disabled={submitting} className="btn-primary auth-submit">Continue</button>
          </Form>

          {/* Same element and classes as the standalone file: a type="button"
              outside the form, so skipping submits nothing. */}
          <button type="button" className="btn-text onb-skip" onClick={() => navigate("/onboarding/workspace")}>
            Skip for now
          </button>
        </div>
      </div>
    </main>
  );
}
