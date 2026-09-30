import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { landingFor, ONBOARDING_PROFILE } from "~/lib/landing";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/signup";

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // An already-signed-in visitor never drops into /admin: they go wherever the
  // HTML flow says they belong — profile, then workspace, then the workspace.
  if (user) throw redirect(await landingFor(request, user));
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "email");

  if (intent === "google") {
    const { supabase, headers } = createSupabaseServerClient(request);
    const origin = new URL(request.url).origin;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // A Google sign-up has no profile or workspace yet, so it returns to the
      // first onboarding screen; the callback then follows landingFor().
      options: { redirectTo: `${origin}/auth/callback?returnTo=${encodeURIComponent(ONBOARDING_PROFILE)}` },
    });
    if (error || !data.url) return { error: "Google sign-up isn't available right now. Use your email address." };
    throw redirect(data.url, { headers });
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter a valid email address." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address." };

  // The password is collected on the next screen, so the address is carried
  // forward on the URL rather than stashed in the session.
  throw redirect(`/signup/password?email=${encodeURIComponent(email)}`);
}

export default function SignUp() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const pendingIntent = navigation.state !== "idle" ? navigation.formData?.get("intent") : null;

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-inner auth-signin auth-signup">
          <svg className="auth-logo" width={133} height={116} viewBox="0 0 133 116" fill="none" role="img" aria-label="Digital Romanian">
            <use href="#i-dr-logo-full" />
          </svg>

          <h1 tabIndex={-1}>Sign up</h1>
          <p className="auth-lead">
            Already have an account?{" "}
            <Link to="/login" className="auth-link-accent">Log In</Link>
          </p>

          <Form method="post" className="signup-form" noValidate>
            <input type="hidden" name="intent" value="email" />

            <div className="auth-field">
              <label htmlFor="signup-email">Email address</label>
              <input id="signup-email" name="email" type="email" autoComplete="email" required className="auth-input" placeholder="example@gmail.com" />
            </div>

            <p role="alert" className="alert-error" hidden={!actionData?.error}>
              {actionData?.error ?? "Enter a valid email address."}
            </p>

            <button type="submit" disabled={submitting} className="btn-primary auth-submit">
              Continue with Email
            </button>
          </Form>

          <div className="auth-divider" role="separator"><span>or</span></div>

          <div className="auth-socials">
            <Form method="post">
              <input type="hidden" name="intent" value="google" />
              <button type="submit" className="auth-social" disabled={pendingIntent === "google"}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true"><use href="#i-google" /></svg>
                <span className="sr-only">Continue with Google</span>
              </button>
            </Form>
            <a className="auth-social" href="/signup" onClick={(event) => event.preventDefault()} title="Continue with Facebook">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true"><use href="#i-facebook" /></svg>
              <span className="sr-only">Continue with Facebook</span>
            </a>
            <a className="auth-social" href="/signup" onClick={(event) => event.preventDefault()} title="Continue with Apple">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true"><use href="#i-apple" /></svg>
              <span className="sr-only">Continue with Apple</span>
            </a>
          </div>

          <p className="auth-footnote auth-terms">
            By signing up, you agree to our <Link to="/signup">Terms of Use</Link> and acknowledge you&apos;ve read our{" "}
            <Link to="/signup">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
