import { useState } from "react";
import { Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/signup-password";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.33 8S3.76 3.33 8 3.33 14.67 8 14.67 8 12.24 12.67 8 12.67 1.33 8 1.33 8Z" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="8" cy="8" r="2" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.5" /></svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><use href="#i-eye-closed" /></svg>
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  const email = new URL(request.url).searchParams.get("email")?.trim() ?? "";
  if (!email) throw redirect("/signup");
  return { email };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!email) return { error: "Enter a valid email address.", email };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", email };
  if (password !== confirm) return { error: "Passwords do not match.", email };

  const { supabase, headers } = createSupabaseServerClient(request);
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // Supabase reports "user already registered" - keep it generic rather than
    // confirming which addresses exist on the service.
    return { error: "We couldn't create that account. Try signing in instead.", email };
  }

  /* When email confirmation is switched off in the Supabase project,
     signUp() returns a session immediately and that session is written to a
     Set-Cookie header collected while the client ran. Without passing those
     headers on the redirect the cookie is thrown away, the next request is
     anonymous, and /onboarding/profile bounces straight back to /login - which
     is exactly the "signed up but never saw the profile screen" report. Same
     pattern as login.tsx and logout.tsx. */
  throw redirect("/signup/created", { headers });

  /* With confirmation enabled there is no session yet (data.session is null)
     and the browser has no cookie to carry, so the user has to sign in once
     before onboarding. That is expected and needs no extra handling here. */
  void data;
}

export default function SetUpPassword() {
  const { email } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-inner auth-signin auth-setpw">
          <svg className="auth-logo" width={133} height={116} viewBox="0 0 133 116" fill="none" role="img" aria-label="Digital Romanian">
            <use href="#i-dr-logo-full" />
          </svg>

          <h1 tabIndex={-1}>Set up your password</h1>

          <Form method="post" className="auth-form" noValidate>
            <input type="hidden" name="email" value={email} />

            <div className="auth-field">
              <label htmlFor="setpw-new">Create password</label>
              <div className="auth-password">
                <input
                  id="setpw-new"
                  name="password"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="auth-input"
                  placeholder="Enter a password"
                  aria-describedby="setpw-hint"
                />
                <button
                  type="button"
                  className="toggle-pw"
                  aria-pressed={showNew}
                  aria-label={showNew ? "Hide password" : "Show password"}
                  title={showNew ? "Hide password" : "Show password"}
                  onClick={() => setShowNew(!showNew)}
                >
                  <EyeIcon open={showNew} />
                </button>
              </div>
              <p className="auth-hint" id="setpw-hint">Must be at least 8 characters long</p>
            </div>

            <div className="auth-field">
              <label htmlFor="setpw-confirm">Confirm password</label>
              <div className="auth-password">
                <input
                  id="setpw-confirm"
                  name="confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="auth-input"
                  placeholder="Re-enter your password"
                />
                <button
                  type="button"
                  className="toggle-pw"
                  aria-pressed={showConfirm}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  title={showConfirm ? "Hide password" : "Show password"}
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>

            <p role="alert" className="alert-error" hidden={!actionData?.error}>{actionData?.error ?? ""}</p>

            <button type="submit" disabled={submitting} className="btn-primary auth-submit">
              Create Account
            </button>
          </Form>
        </div>
      </div>
    </main>
  );
}
