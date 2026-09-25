import { useState } from "react";
import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/reset-password";

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) throw redirect("/admin");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { error: "Enter the email address you use to sign in." };
  }

  const { supabase, headers } = createSupabaseServerClient(request);
  const origin = new URL(request.url).origin;

  // Always show the generic "link is on its way" message, whether or not an
  // account exists — the reset link target (/auth/callback) is a later screen.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback`,
  });

  if (error) return { error: "We couldn't send a reset link right now. Try again in a moment." };

  return { ok: true, email };
}

export default function ResetPassword() {
  const actionData = useActionData<typeof action>();
  const success = actionData && "ok" in actionData ? actionData : null;
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const [useDifferent, setUseDifferent] = useState(false);
  const showSent = Boolean(success) && !useDifferent;

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-inner auth-center auth-reset">
          <img className="auth-logo" src="/digital-romanian.png" alt="Digital Romanian" width={133} height={116} />

          <h1 tabIndex={-1}>Reset your password</h1>
          <p className="auth-lead">Enter your email address and we&apos;ll send you a link to reset your password.</p>

          <Form method="post" className="reset-form" noValidate style={{ textAlign: "left" }} hidden={showSent}>
            <div className="auth-field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" required className="auth-input" placeholder="example@gmail.com" />
            </div>

            <p role="alert" className="alert-error" hidden={!actionData?.error}>{actionData?.error ?? "Enter the email address you use to sign in."}</p>

            <button type="submit" disabled={submitting} className="btn-primary auth-submit">
              Send reset link
            </button>
          </Form>

          <div className="reset-sent" hidden={!showSent}>
            <p className="alert-success" role="status">If an account exists for <strong>{success?.email}</strong>, a reset link is on its way. Check your inbox and spam folder.</p>
            <button type="button" className="btn-outline" onClick={() => setUseDifferent(true)}>Use a different email</button>
          </div>

          <Link to="/login" className="back-link">
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}