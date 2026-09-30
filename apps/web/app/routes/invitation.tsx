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
        <div className="auth-inner auth-center auth-invite">
          <svg className="auth-logo" width={133} height={116} viewBox="0 0 133 116" fill="none" role="img" aria-label="Digital Romanian">
            <use href="#i-dr-logo-full" />
          </svg>

          <div className="invite-icon" aria-hidden="true">
            <svg className="mail" width={40} height={40} viewBox="0 0 40 40" fill="none" aria-hidden="true"><use href="#i-mail" /></svg>
          </div>

          <h1 tabIndex={-1}>You&apos;ve been invited!</h1>
          <p className="auth-lead">Alex Radu <strong>has invited you</strong> to join the Digital Romanian workspace.</p>

          <div hidden={declined}>
            <dl className="invite-details">
              <div><dt>Workspace</dt><dd>Digital Romanian</dd></div>
              <div><dt>Role</dt><dd>Editor</dd></div>
              <div><dt>Access</dt><dd>All sites in this workspace</dd></div>
            </dl>
            <div className="invite-actions">
              <Link to="/workspace" className="btn-primary">Accept invitation</Link>
              <button type="button" className="btn-outline" onClick={() => setDeclined(true)}>Decline</button>
            </div>
            <p className="invite-expiry">This invitation will expire in 7 days.</p>
          </div>

          <div className="invite-declined" hidden={!declined}>
            <p className="alert-success" role="status">Invitation declined. Alex Radu will be notified. If this was a mistake, ask them to send a new invite.</p>
            <Link to="/login" className="back-link">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <use href="#i-arrow-left" />
            </svg>
            Go to sign in
          </Link>
          </div>
        </div>
      </div>
    </main>
  );
}