import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/invitation";

export async function loader({}: Route.LoaderArgs) {
  return null;
}

export default function Invitation() {
  const [declined, setDeclined] = useState(false);

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-inner auth-center">
          <img className="auth-logo" src="/digital-romanian.png" alt="Digital Romanian" width={133} height={116} />

          <div className="invite-icon" aria-hidden="true">
            <svg className="mail" width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M5.48816 8.8215C5.78976 8.51989 6.20643 8.33334 6.66667 8.33334H33.3333C33.7936 8.33334 34.2102 8.51989 34.5118 8.8215M5.48816 8.8215C5.18655 9.12311 5 9.53977 5 10V30C5 30.9205 5.74619 31.6667 6.66667 31.6667H33.3333C34.2538 31.6667 35 30.9205 35 30V10C35 9.53977 34.8135 9.12311 34.5118 8.8215M5.48816 8.8215L17.643 20.9762C18.9447 22.278 21.0553 22.278 22.357 20.9762L34.5118 8.8215" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>

          <h1 tabIndex={-1}>You&apos;ve been invited!</h1>
          <p className="auth-lead" style={{ fontSize: 14, fontWeight: 400 }}>Alex Radu <strong>has invited you</strong> to join the Digital Romanian workspace.</p>

          <div hidden={declined}>
            <dl className="invite-details">
              <div><dt>Workspace</dt><dd>Digital Romanian</dd></div>
              <div><dt>Role</dt><dd>Editor</dd></div>
              <div><dt>Access</dt><dd>All sites in this workspace</dd></div>
            </dl>
            <div className="invite-actions">
              <Link to="/admin" className="btn-primary">Accept invitation</Link>
              <button type="button" className="btn-outline" onClick={() => setDeclined(true)}>Decline</button>
            </div>
            <p className="invite-expiry">This invitation will expire in 7 days.</p>
          </div>

          <div className="invite-declined" hidden={!declined}>
            <p className="alert-success" role="status">Invitation declined. Alex Radu will be notified. If this was a mistake, ask them to send a new invite.</p>
            <Link to="/login" className="back-link">Go to sign in</Link>
          </div>
        </div>
      </div>
    </main>
  );
}