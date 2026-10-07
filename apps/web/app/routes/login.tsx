import { useState } from "react";
import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { landingFor, WORKSPACE_HOME } from "~/lib/landing";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/login";

function returnTo(request: Request) {
  const path = new URL(request.url).searchParams.get("returnTo");
  if (!path || !path.startsWith("/")) return null;
  // /admin is a site editor reached *from* a workspace, not a landing page. The
  // admin layout sends unauthenticated visitors here with
  // ?returnTo=/admin/..., and honouring that is what used to drop a freshly
  // signed-in user straight into the editor instead of the workspace screen.
  // Those destinations fall through to landingFor() below, which walks the
  // prototype's order: profile -> workspace -> /workspace.
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  return path;
}

/* Where a signed-in user should actually land. Onboarding screens always win:
   a fresh account that arrived via /login?returnTo=/workspace (site-access
   sends signed-out visitors there from any protected path) must still be sent
   through profile -> workspace before the workspace itself. Only once
   landingFor() is happy with a fully onboarded user does a requested
   destination take effect. */
async function landingDestination(request: Request, user: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  const landing = await landingFor(request, user);
  if (landing !== WORKSPACE_HOME) return landing;
  return returnTo(request) ?? landing;
}

async function currentUser(request: Request) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await currentUser(request);
  if (user) throw redirect(await landingDestination(request, user));
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "password");
  const { supabase, headers } = createSupabaseServerClient(request);

  if (intent === "google") {
    // Needs an /auth/callback route that calls supabase.auth.exchangeCodeForSession(code)
    // and then redirects to the returnTo param.
    const origin = new URL(request.url).origin;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback?returnTo=${encodeURIComponent(returnTo(request) ?? "")}` },
    });
    if (error || !data.url) return { error: "Google sign-in isn't available right now. Use your email and password." };
    throw redirect(data.url, { headers });
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  // "remember" is sent from the checkbox. Wire it to the session cookie lifetime
  // in createSupabaseServerClient when you're ready; it doesn't change anything yet.
  // const remember = formData.get("remember") === "on";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Never distinguish "no such account" from "wrong password" here —
    // that lets an attacker enumerate registered emails.
    return { error: "Invalid email or password." };
  }

  const {
    data: { user: signedIn },
  } = await supabase.auth.getUser();

  // No profile yet or no workspace yet means the HTML flow still has screens
  // to show, so those win over any requested destination.
  if (signedIn) {
    throw redirect(await landingDestination(request, signedIn), { headers });
  }

  // signInWithPassword succeeded but getUser() came back empty: fall back to the
  // requested destination rather than inventing a landing.
  throw redirect(returnTo(request) ?? "/workspace", { headers });
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.33 8S3.76 3.33 8 3.33 14.67 8 14.67 8 12.24 12.67 8 12.67 1.33 8 1.33 8Z" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="8" cy="8" r="2" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.5" /></svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.3333 9.88898C14.2054 8.88783 14.6666 8 14.6666 8C14.6666 8 12.2424 3.33333 7.99998 3.33333C7.7725 3.33333 7.55024 3.34675 7.33331 3.37215C7.10517 3.39886 6.88291 3.43881 6.66665 3.49034M7.99998 6C8.23374 6 8.45813 6.0401 8.66665 6.1138C9.23492 6.31466 9.68532 6.76506 9.88618 7.33333C9.95988 7.54185 9.99998 7.76624 9.99998 8M1.99998 2L14 14M7.99998 10C7.76622 10 7.54183 9.9599 7.33331 9.8862C6.76503 9.68534 6.31464 9.23494 6.11378 8.66667C6.07589 8.55946 6.04687 8.44805 6.02763 8.33333M2.76466 6C2.55916 6.22967 2.37487 6.45494 2.2124 6.66667C1.63522 7.41882 1.33331 8 1.33331 8C1.33331 8 3.75756 12.6667 7.99998 12.6667C8.22746 12.6667 8.44971 12.6532 8.66665 12.6279" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const pendingIntent = navigation.state !== "idle" ? navigation.formData?.get("intent") : null;
  const signingIn = pendingIntent === "password";
  const googlePending = pendingIntent === "google";

  const [visible, setVisible] = useState(false);

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-inner auth-signin">
          <svg className="auth-logo" width={133} height={116} viewBox="0 0 133 116" fill="none" role="img" aria-label="Digital Romanian">
            <use href="#i-dr-logo-full" />
          </svg>

          <h1 id="auth-title">Welcome back</h1>
          <p className="auth-lead">Sign in to your account to continue.</p>

          <Form method="post" className="auth-form">
            <input type="hidden" name="intent" value="password" />

            <div className="auth-field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" autoComplete="username" required className="auth-input" placeholder="example@gmail.com" />
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <div className="auth-password">
                <input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required className="auth-input" placeholder="Enter your password" />
                <button type="button" className="toggle-pw" onClick={() => setVisible(!visible)} aria-pressed={visible} aria-label={visible ? "Hide password" : "Show password"} title={visible ? "Hide password" : "Show password"}>
                  <EyeIcon open={visible} />
                </button>
              </div>
            </div>

            {actionData?.error ? <p role="alert" className="alert-error">{actionData.error}</p> : null}

            <button type="submit" disabled={signingIn} className="btn-primary auth-submit">
              {signingIn ? "Signing in…" : "Sign in"}
            </button>

            <div className="auth-options">
              <label className="auth-check">
                <input type="checkbox" name="remember" defaultChecked />
                Keep me signed in
              </label>
              <Link to="/reset-password" className="auth-link">Forgot password?</Link>
            </div>
          </Form>

          <div className="auth-divider" role="separator"><span>or</span></div>

          <div className="auth-socials">
            <Form method="post">
              <input type="hidden" name="intent" value="google" />
              <button type="submit" className="auth-social" disabled={googlePending}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true"><use href="#i-google" /></svg>
                <span className="sr-only">{googlePending ? "Redirecting to Google…" : "Continue with Google"}</span>
              </button>
            </Form>
            <a className="auth-social" href="/login" onClick={(event) => event.preventDefault()} title="Continue with Facebook">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true"><use href="#i-facebook" /></svg>
              <span className="sr-only">Continue with Facebook</span>
            </a>
            <a className="auth-social" href="/login" onClick={(event) => event.preventDefault()} title="Continue with Apple">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true"><use href="#i-apple" /></svg>
              <span className="sr-only">Continue with Apple</span>
            </a>
          </div>

          <p className="auth-footnote">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="auth-link-accent">Sign up</Link>
          </p>
        </div>
      </section>
    </main>
  );
}