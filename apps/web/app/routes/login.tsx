import { useState } from "react";
import { Form, redirect, useActionData, useNavigation } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/login";

function returnTo(request: Request) {
  const path = new URL(request.url).searchParams.get("returnTo");
  return path && (path === "/admin" || path.startsWith("/admin/")) ? path : "/admin";
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) throw redirect(returnTo(request));
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const { supabase, headers } = createSupabaseServerClient(request);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Never distinguish "no such account" from "wrong password" here —
    // that lets an attacker enumerate registered emails.
    return { error: "Invalid email or password." };
  }

  throw redirect(returnTo(request), { headers });
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const [visible, setVisible] = useState(false);

  return (
    <main className="auth-page">
      <a className="brand auth-brand" href="/login"><span className="brand-mark">D</span><span>Digital Romanian<span className="brand-caption">Website administration</span></span></a>
      <section className="auth-card">
        <span className="eyebrow">YOUR WORKSPACE, CONNECTED</span>
        <h1>Welcome back.</h1>
        <p className="muted">Sign in to build, manage, and publish your websites.</p>
        <Form method="post" className="auth-form">
          <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="username" required className="input" placeholder="you@company.com" /></div>
          <div className="field"><label htmlFor="password">Password</label><div className="password-field"><input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required className="input" /><button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible} aria-label={visible ? "Hide password" : "Show password"} title={visible ? "Hide password" : "Show password"}>{visible ? <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></div>
          {actionData?.error ? <p role="alert" className="alert-error">{actionData.error}</p> : null}
          <button type="submit" disabled={submitting} className="btn auth-submit">{submitting ? "Signing in…" : "Sign in"}<span aria-hidden="true">→</span></button>
        </Form>
        <details className="auth-help"><summary>Need help signing in?</summary><p>Contact your workspace owner to request access or help recovering your account.</p></details>
      </section>
      <footer className="auth-footer">Your next great website starts here.</footer>
    </main>
  );
}
