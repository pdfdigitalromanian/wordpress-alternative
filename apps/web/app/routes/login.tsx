import { useState } from "react";
import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
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
  const intent = String(formData.get("intent") ?? "password");
  const { supabase, headers } = createSupabaseServerClient(request);

  if (intent === "google") {
    // Needs an /auth/callback route that calls supabase.auth.exchangeCodeForSession(code)
    // and then redirects to the returnTo param.
    const origin = new URL(request.url).origin;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback?returnTo=${encodeURIComponent(returnTo(request))}` },
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

  throw redirect(returnTo(request), { headers });
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.33 8S3.76 3.33 8 3.33 14.67 8 14.67 8 12.24 12.67 8 12.67 1.33 8 1.33 8Z" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="8" cy="8" r="2" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.5" /></svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.3333 9.88898C14.2054 8.88783 14.6666 8 14.6666 8C14.6666 8 12.2424 3.33333 7.99998 3.33333C7.7725 3.33333 7.55024 3.34675 7.33331 3.37215C7.10517 3.39886 6.88291 3.43881 6.66665 3.49034M7.99998 6C8.23374 6 8.45813 6.0401 8.66665 6.1138C9.23492 6.31466 9.68532 6.76506 9.88618 7.33333C9.95988 7.54185 9.99998 7.76624 9.99998 8M1.99998 2L14 14M7.99998 10C7.76622 10 7.54183 9.9599 7.33331 9.8862C6.76503 9.68534 6.31464 9.23494 6.11378 8.66667C6.07589 8.55946 6.04687 8.44805 6.02763 8.33333M2.76466 6C2.55916 6.22967 2.37487 6.45494 2.2124 6.66667C1.63522 7.41882 1.33331 8 1.33331 8C1.33331 8 3.75756 12.6667 7.99998 12.6667C8.22746 12.6667 8.44971 12.6532 8.66665 12.6279" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path fill="#FFC107" d="M23.7666 9.6498H22.8V9.6H12V14.4H18.7818C17.7924 17.1942 15.1338 19.2 12 19.2C8.0238 19.2 4.8 15.9762 4.8 12C4.8 8.0238 8.0238 4.8 12 4.8C13.8354 4.8 15.5052 5.4924 16.7766 6.6234L20.1708 3.2292C18.0276 1.2318 15.1608 0 12 0C5.373 0 0 5.373 0 12C0 18.627 5.373 24 12 24C18.627 24 24 18.627 24 12C24 11.1954 23.9172 10.41 23.7666 9.6498Z" />
      <path fill="#FF3D00" d="M1.38354 6.4146L5.32614 9.306C6.39294 6.6648 8.97655 4.8 11.9999 4.8C13.8353 4.8 15.5051 5.4924 16.7765 6.6234L20.1707 3.2292C18.0275 1.2318 15.1607 0 11.9999 0C7.39075 0 3.39354 2.6022 1.38354 6.4146Z" />
      <path fill="#4CAF50" d="M12.0001 24C15.0997 24 17.9161 22.8138 20.0455 20.8848L16.3315 17.742C15.1267 18.6546 13.6291 19.2 12.0001 19.2C8.87894 19.2 6.22874 17.2098 5.23034 14.4324L1.31714 17.4474C3.30314 21.3336 7.33634 24 12.0001 24Z" />
      <path fill="#1976D2" d="M23.7666 9.6499H22.8V9.6001H12V14.4001H18.7818C18.3066 15.7423 17.4432 16.8997 16.3296 17.7427L16.3314 17.7415L20.0454 20.8843C19.7826 21.1231 24 18.0001 24 12.0001C24 11.1955 23.9172 10.4101 23.7666 9.6499Z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path fill="#0866FF" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
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
          <img className="auth-logo" src="/digital-romanian.png" alt="Digital Romanian" width={133} height={116} />

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
                <GoogleIcon />
                <span className="sr-only">{googlePending ? "Redirecting to Google…" : "Continue with Google"}</span>
              </button>
            </Form>
            <a className="auth-social" href="/login" onClick={(event) => event.preventDefault()} title="Continue with Facebook">
              <FacebookIcon />
              <span className="sr-only">Continue with Facebook</span>
            </a>
            <a className="auth-social" href="/login" onClick={(event) => event.preventDefault()} title="Continue with Apple">
              <AppleIcon />
              <span className="sr-only">Continue with Apple</span>
            </a>
          </div>

          <p className="auth-footnote">Don't have an account? Contact your workspace owner.</p>
        </div>
      </section>
    </main>
  );
}