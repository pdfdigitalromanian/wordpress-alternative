import { Link } from "react-router";
import type { Route } from "./+types/signup-created";

export async function loader({}: Route.LoaderArgs) {
  return null;
}

export default function SignupCreated() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-inner auth-center auth-created">
          <h1 tabIndex={-1}>Account Created</h1>

          <div className="created-check" aria-hidden="true">
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none"><use href="#i-check" /></svg>
          </div>

          <p className="auth-lead">Your account has been created successfully.</p>

          <Link to="/onboarding/profile" className="btn-primary created-cta">Set up your profile</Link>
        </div>
      </div>
    </main>
  );
}
