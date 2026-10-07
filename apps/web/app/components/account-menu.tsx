import { useEffect, useId, useRef, useState } from "react";
import { Form, Link } from "react-router";
import { Pmark } from "~/components/workspace-sidebar";

/* The top-right profile dropdown (.me-wrap / .me-btn / .me-menu) from
   digital-romanian-screens.html lines 1470-1476.

   The prototype's own comment is explicit about where Sign out belongs: "profile
   dropdown (sign out lives here, not in the workspace switcher)" (line 872).
   The port had only wired up the .me-btn trigger with no menu behind it, so the
   account button in the header did nothing at all.

   The three rows are fixed by the design:
     - head: name over email, above a hairline
     - Edit profile            -> /onboarding/profile
     - Workspace settings      -> /settings
     - Sign out (danger)       -> POST /logout

   Close behaviour follows closeMeMenus() at line 2367: Escape closes and
   returns focus to the trigger, a click anywhere outside closes, and clicking
   the trigger toggles. */

const icon = (id: string, w = 16, h = w, vb = `0 0 ${w} ${h}`) => (
  <svg width={w} height={h} viewBox={vb} fill="none" aria-hidden="true">
    <use href={`#${id}`} />
  </svg>
);

/* The sign-out glyph is drawn inline in the prototype (line 1475) rather than
   pulled from the sprite, so it is reproduced exactly rather than approximated
   with a different icon. */
function SignOutIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 13.5H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H6M10.5 11l3-3-3-3M13.5 8H6"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AccountMenu({ name, email, size = 32 }: { name: string; email: string; size?: number }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Hand focus back to the trigger, as closeMeMenus(focus) does.
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="me-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={buttonRef}
        className="me-btn"
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <Pmark name={name} email={email} size={size} />
        {icon("i-chevron-down", 16, 16, "0 0 16 16")}
      </button>

      <div className="me-menu" id={menuId} hidden={!open}>
        <div className="me-head">
          <Pmark name={name} email={email} size={36} />
          <div>
            <strong>{name || "No name"}</strong>
            <small>{email || "No email"}</small>
          </div>
        </div>
        <Link to="/onboarding/profile" onClick={() => setOpen(false)}>
          {icon("i-person", 16, 16, "0 0 16 16")}
          Edit profile
        </Link>
        <Link to="/settings" onClick={() => setOpen(false)}>
          {icon("i-settings", 16, 16, "0 0 16 16")}
          Workspace settings
        </Link>
        <hr />
        <Form method="post" action="/logout">
          <button type="submit" className="danger">
            <SignOutIcon />
            Sign out
          </button>
        </Form>
      </div>
    </div>
  );
}