import { useCallback, useEffect, useRef, useState } from "react";
import { Form, Link, NavLink, useActionData, useLoaderData } from "react-router";
import { CreateWorkspaceDialog, InviteDialog, Toast } from "~/components/workspace-dialogs";
import { useResultToast } from "~/components/workspace-shell";
import { Wmark } from "~/components/workspace-sidebar";
import { handleWorkspaceAction } from "~/lib/workspace-actions.server";
import { loadWorkspaceScreen } from "~/lib/workspace.server";
import "./overview.css";
import type { Route } from "./+types/overview";

/* The /overview screen from digital-romanian-screens.html: the central
   workspace & site switcher plus the grouped sidebar. The demo WORKSPACES /
   SITES arrays in that file are replaced by the signed-in user's real rows,
   and the two switcher actions open the same #dlg-create-ws and #dlg-invite
   dialogs the workspace screen uses, exactly as data-open="create-ws" and
   data-open="invite" do there. */

export async function loader({ request }: Route.LoaderArgs) {
  return loadWorkspaceScreen(request);
}

export async function action({ request }: Route.ActionArgs) {
  return handleWorkspaceAction(request, await request.formData());
}

const DR_LOGO = (
  <svg className="dr-logo" width="40" height="32" viewBox="0 0 40 32" fill="none" aria-hidden="true"><image href="/digital-romanian.png" x="0" y="0" width="40" height="32" preserveAspectRatio="none" /></svg>
);

const checkSvg = (
  <svg className="check" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.0001 7L9.0001 18L4 13" /></svg>
);
const chevronSvg = (
  <svg className="chev" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><g opacity="0.6"><path d="M2.66666 6L7.99999 11.3333L13.3333 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g></svg>
);
const switcherIco = (
  <svg className="switcher-ico" width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true"><path d="M1.0595 16.171C0.353167 15.4647 0 14.6128 0 13.6152C0 12.6177 0.353167 11.7658 1.0595 11.0595C1.76583 10.3532 2.61775 10 3.61525 10C4.61275 10 5.46467 10.3532 6.171 11.0595C6.87733 11.7658 7.2305 12.6177 7.2305 13.6152C7.2305 14.6128 6.87733 15.4647 6.171 16.171C5.46467 16.8773 4.61275 17.2305 3.61525 17.2305C2.61775 17.2305 1.76583 16.8773 1.0595 16.171ZM13.0595 16.171C12.3532 15.4647 12 14.6128 12 13.6152C12 12.6177 12.3532 11.7658 13.0595 11.0595C13.7658 10.3532 14.6177 10 15.6152 10C16.6127 10 17.4647 10.3532 18.171 11.0595C18.8773 11.7658 19.2305 12.6177 19.2305 13.6152C19.2305 14.6128 18.8773 15.4647 18.171 16.171C17.4647 16.8773 16.6127 17.2305 15.6152 17.2305C14.6177 17.2305 13.7658 16.8773 13.0595 16.171ZM5.1095 15.1095C5.52367 14.6953 5.73075 14.1972 5.73075 13.6152C5.73075 13.0332 5.52367 12.5352 5.1095 12.121C4.69533 11.7068 4.19725 11.4998 3.61525 11.4998C3.03325 11.4998 2.53517 11.7068 2.121 12.121C1.70683 12.5352 1.49975 13.0332 1.49975 13.6152C1.49975 14.1972 1.70683 14.6953 2.121 15.1095C2.53517 15.5237 3.03325 15.7308 3.61525 15.7308C4.19725 15.7308 4.69533 15.5237 5.1095 15.1095ZM17.1095 15.1095C17.5237 14.6953 17.7307 14.1972 17.7307 13.6152C17.7307 13.0332 17.5237 12.5352 17.1095 12.121C16.6953 11.7068 16.1973 11.4998 15.6152 11.4998C15.0332 11.4998 14.5352 11.7068 14.121 12.121C13.7068 12.5352 13.4998 13.0332 13.4998 13.6152C13.4998 14.1972 13.7068 14.6953 14.121 15.1095C14.5352 15.5237 15.0332 15.7308 15.6152 15.7308C16.1973 15.7308 16.6953 15.5237 17.1095 15.1095ZM7.0595 6.171C6.35317 5.46467 6 4.61275 6 3.61525C6 2.61775 6.35317 1.76583 7.0595 1.0595C7.76583 0.353167 8.61775 0 9.61525 0C10.6128 0 11.4647 0.353167 12.171 1.0595C12.8773 1.76583 13.2305 2.61775 13.2305 3.61525C13.2305 4.61275 12.8773 5.46467 12.171 6.171C11.4647 6.87733 10.6128 7.2305 9.61525 7.2305C8.61775 7.2305 7.76583 6.87733 7.0595 6.171ZM11.1095 5.1095C11.5237 4.69533 11.7308 4.19725 11.7308 3.61525C11.7308 3.03325 11.5237 2.53517 11.1095 2.121C10.6953 1.70683 10.1972 1.49975 9.61525 1.49975C9.03325 1.49975 8.53517 1.70683 8.121 2.121C7.70683 2.53517 7.49975 3.03325 7.49975 3.61525C7.49975 4.19725 7.70683 4.69533 8.121 5.1095C8.53517 5.52367 9.03325 5.73075 9.61525 5.73075C10.1972 5.73075 10.6953 5.52367 11.1095 5.1095Z" fill="currentColor" /></svg>
);

const OVERVIEW_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9.17647 5.17647V0H16V5.17647H9.17647ZM0 8.47059V0H6.82353V8.47059H0ZM9.17647 16V7.52941H16V16H9.17647ZM0 16V10.8235H6.82353V16H0ZM1.41176 7.05882H5.41176V1.41176H1.41176V7.05882ZM10.5882 14.5882H14.5882V8.94118H10.5882V14.5882ZM10.5882 3.76471H14.5882V1.41176H10.5882V3.76471ZM1.41176 14.5882H5.41176V12.2353H1.41176V14.5882Z" fill="currentColor" /></svg>
);
const WEBSITE_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.89474 15.3693C3.9214 14.9488 3.07256 14.3763 2.34821 13.6518C1.62372 12.9274 1.05123 12.0786 0.630737 11.1053C0.210246 10.1319 0 9.09467 0 7.99347C0 6.89228 0.210246 5.85719 0.630737 4.88821C1.05123 3.91923 1.62372 3.07256 2.34821 2.34821C3.07256 1.62372 3.9214 1.05123 4.89474 0.630737C5.86807 0.210246 6.90533 0 8.00653 0C9.10772 0 10.1428 0.210246 11.1118 0.630737C12.0808 1.05123 12.9274 1.62372 13.6518 2.34821C14.3763 3.07256 14.9488 3.91923 15.3693 4.88821C15.7898 5.85719 16 6.89228 16 7.99347C16 9.09467 15.7898 10.1319 15.3693 11.1053C14.9488 12.0786 14.3763 12.9274 13.6518 13.6518C12.9274 14.3763 12.0808 14.9488 11.1118 15.3693C10.1428 15.7898 9.10772 16 8.00653 16C6.90533 16 5.86807 15.7898 4.89474 15.3693ZM8 14.7189C8.42976 14.149 8.79144 13.5741 9.08505 12.9943C9.37867 12.4145 9.61782 11.7808 9.80253 11.0931H6.19747C6.39298 11.8024 6.63488 12.4469 6.92316 13.0267C7.2113 13.6065 7.57025 14.1706 8 14.7189ZM6.36926 14.4874C6.04646 14.0242 5.75656 13.4977 5.49958 12.9078C5.2426 12.3178 5.04288 11.7128 4.90042 11.0931H2.04379C2.48856 11.9676 3.08505 12.7023 3.83326 13.2973C4.58147 13.8921 5.42681 14.2888 6.36926 14.4874ZM9.63074 14.4874C10.5732 14.2888 11.4185 13.8921 12.1667 13.2973C12.9149 12.7023 13.5114 11.9676 13.9562 11.0931H11.0996C10.93 11.7182 10.7168 12.3258 10.4598 12.9158C10.2029 13.5058 9.9266 14.0297 9.63074 14.4874ZM1.51411 9.8299H4.64463C4.59172 9.51691 4.55333 9.21004 4.52947 8.90926C4.50575 8.60863 4.49389 8.30554 4.49389 8C4.49389 7.69446 4.50575 7.39137 4.52947 7.09074C4.55333 6.78997 4.59172 6.48309 4.64463 6.17011H1.51411C1.43312 6.45614 1.37109 6.75354 1.328 7.06232C1.28477 7.37109 1.26316 7.68365 1.26316 8C1.26316 8.31635 1.28477 8.62891 1.328 8.93769C1.37109 9.24646 1.43312 9.54386 1.51411 9.8299ZM5.90758 9.8299H10.0924C10.1452 9.51691 10.1835 9.21277 10.2074 8.91747C10.2311 8.62218 10.2429 8.31635 10.2429 8C10.2429 7.68365 10.2311 7.37782 10.2074 7.08253C10.1835 6.78723 10.1452 6.48309 10.0924 6.17011H5.90758C5.85481 6.48309 5.81649 6.78723 5.79263 7.08253C5.76891 7.37782 5.75705 7.68365 5.75705 8C5.75705 8.31635 5.76891 8.62218 5.79263 8.91747C5.81649 9.21277 5.85481 9.51691 5.90758 9.8299ZM11.3554 9.8299H14.4859C14.5669 9.54386 14.6289 9.24646 14.672 8.93769C14.7152 8.62891 14.7368 8.31635 14.7368 8C14.7368 7.68365 14.7152 7.37109 14.672 7.06232C14.6289 6.75354 14.5669 6.45614 14.4859 6.17011H11.3554C11.4083 6.48309 11.4467 6.78997 11.4705 7.09074C11.4942 7.39137 11.5061 7.69446 11.5061 8C11.5061 8.30554 11.4942 8.60863 11.4705 8.90926C11.4467 9.21004 11.4083 9.51691 11.3554 9.8299ZM11.0996 4.90695H13.9562C13.5061 4.02161 12.9137 3.28688 12.1789 2.70274C11.4442 2.11874 10.5948 1.7193 9.63074 1.50442C9.95354 1.99453 10.2407 2.5306 10.4922 3.11263C10.7439 3.69453 10.9463 4.29263 11.0996 4.90695ZM6.19747 4.90695H9.80253C9.60702 4.20295 9.36112 3.55432 9.06484 2.96105C8.76842 2.36779 8.41347 1.80779 8 1.28105C7.58653 1.80779 7.23158 2.36779 6.93516 2.96105C6.63888 3.55432 6.39298 4.20295 6.19747 4.90695ZM2.04379 4.90695H4.90042C5.05368 4.29263 5.25614 3.69453 5.50779 3.11263C5.7593 2.5306 6.04646 1.99453 6.36926 1.50442C5.39972 1.7193 4.54898 2.12014 3.81705 2.70695C3.08498 3.29361 2.49389 4.02695 2.04379 4.90695Z" fill="currentColor" /></svg>
);
const CONTENT_ICON = (
  <svg width="16" height="19" viewBox="0 0 16 19" fill="none" aria-hidden="true"><path d="M4 15.25H12V13.75H4V15.25ZM4 11.25H12V9.75H4V11.25ZM1.92827 19C1.38942 19 0.933333 18.825 0.56 18.475C0.186667 18.125 0 17.6974 0 17.1923V1.80775C0 1.30258 0.186667 0.875 0.56 0.525C0.933333 0.175 1.38942 0 1.92827 0H10.4L16 5.25V17.1923C16 17.6974 15.8133 18.125 15.44 18.475C15.0667 18.825 14.6106 19 14.0717 19H1.92827ZM9.6 6V1.5H1.92827C1.84613 1.5 1.77093 1.53208 1.70267 1.59625C1.63422 1.66025 1.6 1.73075 1.6 1.80775V17.1923C1.6 17.2693 1.63422 17.3398 1.70267 17.4038C1.77093 17.4679 1.84613 17.5 1.92827 17.5H14.0717C14.1539 17.5 14.2291 17.4679 14.2973 17.4038C14.3658 17.3398 14.4 17.2693 14.4 17.1923V6H9.6Z" fill="currentColor" /></svg>
);
const STORE_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M0.971659 1.54839V0H15.0283V1.54839H0.971659ZM1.0064 16V9.80645H0V8.25806L0.971659 3.09677H15.0283L16 8.25806V9.80645H14.9936V16H13.64V9.80645H9.5792V16H1.0064ZM2.36 14.4516H8.2256V9.80645H2.36V14.4516ZM1.38112 8.25806H14.6189L13.9299 4.64516H2.07011L1.38112 8.25806Z" fill="currentColor" /></svg>
);
const PUBLISHING_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M7.2 16V7.04L4.5704 9.6696L3.44613 8.5128L8 3.95893L12.5539 8.5128L11.4296 9.6696L8.8 7.04V16H7.2ZM0 4.82053V1.92827C0 1.38942 0.186667 0.933333 0.56 0.56C0.933333 0.186667 1.38942 0 1.92827 0H14.0717C14.6106 0 15.0667 0.186667 15.44 0.56C15.8133 0.933333 16 1.38942 16 1.92827V4.82053H14.4V1.92827C14.4 1.84613 14.3658 1.77093 14.2973 1.70267C14.2291 1.63422 14.1539 1.6 14.0717 1.6H1.92827C1.84613 1.6 1.77093 1.63422 1.70267 1.70267C1.63422 1.77093 1.6 1.84613 1.6 1.92827V4.82053H0Z" fill="currentColor" /></svg>
);
const SETTINGS_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6.03512 16L5.71094 13.4347C5.4829 13.3592 5.24904 13.2535 5.00937 13.1175C4.76983 12.9813 4.55563 12.8356 4.36675 12.6802L1.96467 13.6842L0 10.3158L2.07769 8.76274C2.05811 8.63754 2.0442 8.51179 2.03597 8.38547C2.02774 8.25916 2.02363 8.13333 2.02363 8.008C2.02363 7.88828 2.02774 7.7666 2.03597 7.64295C2.0442 7.5193 2.05811 7.38407 2.07769 7.23726L0 5.68421L1.96467 2.332L4.35845 3.328C4.56379 3.16716 4.78296 3.02007 5.01596 2.88674C5.24897 2.7534 5.47793 2.64625 5.70285 2.56526L6.03512 0H9.96488L10.2891 2.57326C10.5445 2.66505 10.7756 2.77221 10.9823 2.89474C11.1892 3.01726 11.398 3.16168 11.6088 3.328L14.0353 2.332L16 5.68421L13.8895 7.26147C13.92 7.39747 13.9367 7.52463 13.9395 7.64295C13.9422 7.76112 13.9436 7.88014 13.9436 8C13.9436 8.11439 13.9408 8.23074 13.9353 8.34905C13.9299 8.46723 13.9103 8.60246 13.8765 8.75474L15.9706 10.3158L14.0057 13.6842L11.6088 12.672C11.398 12.8383 11.183 12.9854 10.9636 13.1133C10.7442 13.2413 10.5194 13.3458 10.2891 13.4267L9.96488 16H6.03512ZM7.14857 14.7368H8.82205L9.12814 12.4811C9.56265 12.3688 9.9597 12.2093 10.3193 12.0025C10.679 11.7956 11.0259 11.5298 11.3599 11.2048L13.4753 12.0842L14.3137 10.6526L12.4668 9.27621C12.5377 9.05811 12.586 8.84428 12.6115 8.63474C12.6372 8.42533 12.6501 8.21375 12.6501 8C12.6501 7.78077 12.6372 7.56919 12.6115 7.36526C12.586 7.16119 12.5377 6.95277 12.4668 6.74L14.3299 5.34737L13.4917 3.91579L11.3516 4.808C11.0667 4.50681 10.7253 4.2407 10.3276 4.00969C9.92968 3.77867 9.52717 3.61509 9.12005 3.51895L8.85143 1.26316H7.16177L6.87995 3.51095C6.44558 3.61242 6.04449 3.76786 5.67667 3.97726C5.30871 4.18681 4.95771 4.4567 4.62367 4.78695L2.5083 3.91579L1.67007 5.34737L3.50873 6.70274C3.43777 6.9026 3.38811 7.11046 3.35973 7.32632C3.33135 7.54218 3.31716 7.7694 3.31716 8.008C3.31716 8.22723 3.33135 8.44211 3.35973 8.65263C3.38811 8.86316 3.43508 9.07102 3.50064 9.27621L1.67007 10.6526L2.5083 12.0842L4.61558 11.2C4.9387 11.5281 5.28416 11.797 5.65198 12.0065C6.01994 12.2159 6.42656 12.3768 6.87186 12.4891L7.14857 14.7368ZM8.00979 10.5263C8.71818 10.5263 9.32099 10.2804 9.81822 9.78863C10.3155 9.29684 10.5641 8.70063 10.5641 8C10.5641 7.29937 10.3155 6.70316 9.81822 6.21137C9.32099 5.71958 8.71818 5.47368 8.00979 5.47368C7.29261 5.47368 6.6876 5.71958 6.19476 6.21137C5.70193 6.70316 5.45551 7.29937 5.45551 8C5.45551 8.70063 5.70193 9.29684 6.19476 9.78863C6.6876 10.2804 7.29261 10.5263 8.00979 10.5263Z" fill="currentColor" /></svg>
);

export default function Overview() {
  const data = useLoaderData<typeof loader>();
  const actionResult = useActionData<typeof action>();
  const { toast, setToast } = useResultToast(actionResult, null);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(data.workspaces[0]?.id ?? null);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(["nav-store"]));
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  // state.currentId in the standalone file, the same key the workspace and
  // admin screens read, so all three agree on which workspace is current.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("dr-current-workspace");
      if (stored && data.workspaces.some((w) => w.id === stored)) setActiveWorkspaceId(stored);
    } catch {
      /* private mode */
    }
    // Restore once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const WORKSPACES = data.workspaces.map((w) => ({ id: w.id, name: w.name, ico: <Wmark workspace={w} size={30} /> }));
  const activeWorkspace = data.workspaces.find((w) => w.id === activeWorkspaceId) ?? data.workspaces[0];
  const SITES = (activeWorkspace?.sites ?? []).map((s) => ({ id: s.id, name: s.name }));

  const swBtnRef = useRef<HTMLButtonElement>(null);
  const swPanelRef = useRef<HTMLDivElement>(null);
  const swSearchRef = useRef<HTMLInputElement>(null);
  const swScrollRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("seenSwitcher") === "1";
    } catch {
      /* ignore */
    }
    if (!seen) {
      setSwitcherOpen(true);
      try {
        sessionStorage.setItem("seenSwitcher", "1");
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!switcherOpen) return;
    const onDown = (e: MouseEvent) => {
      if (swPanelRef.current?.contains(e.target as Node) || swBtnRef.current?.contains(e.target as Node)) return;
      setSwitcherOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSwitcherOpen(false);
    };
    // The standalone file's delegated handler calls closeSwitcher(false) /
    // closeWsMenu(false) before opening a dialog, so the panel is never left
    // hanging open behind the modal.
    const onOpenDialog = () => setSwitcherOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("ws:close-overlays", onOpenDialog);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("ws:close-overlays", onOpenDialog);
    };
  }, [switcherOpen]);

  useEffect(() => {
    if (!switcherOpen) return;
    /* Short screens (laptops, Windows display scaling): shrink the panel's spacing (never the text)
       so everything down to "Create new site" fits without scrolling. Scrolling stays as a last resort. */
    const fitSwitcher = () => {
      const scroll = swScrollRef.current;
      if (!scroll) return;
      scroll.style.setProperty("--k", "1");
      const avail = parseFloat(getComputedStyle(scroll).maxHeight) || window.innerHeight;
      for (let i = 0; i < 6; i++) {
        const k = parseFloat(scroll.style.getPropertyValue("--k"));
        const need = scroll.scrollHeight;
        if (need <= avail + 1) break;
        scroll.style.setProperty("--k", Math.max(0.35, (k * (avail - 4)) / need).toFixed(3));
      }
    };
    const placeCaret = () => {
      const chev = swBtnRef.current?.querySelector(".chev");
      const panel = swPanelRef.current;
      if (!chev || !panel) return;
      const c = chev.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      panel.style.setProperty("--caret-x", `${c.left + c.width / 2 - p.left}px`);
    };
    fitSwitcher();
    placeCaret();
    const onResize = () => {
      fitSwitcher();
      placeCaret();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [switcherOpen]);

  /* Same idea for the sidebar on short desktop screens: tighten spacing so Settings stays visible. */
  const fitSidebar = useCallback(() => {
    const el = sidebarRef.current;
    if (!el) return;
    el.style.setProperty("--k", "1");
    if (window.matchMedia("(max-width: 760px)").matches) return;
    for (let i = 0; i < 6; i++) {
      const k = parseFloat(el.style.getPropertyValue("--k"));
      const need = el.scrollHeight;
      const avail = el.clientHeight;
      if (need <= avail + 1) break;
      el.style.setProperty("--k", Math.max(0.35, (k * (avail - 4)) / need).toFixed(3));
    }
  }, []);

  useEffect(() => {
    fitSidebar();
    window.addEventListener("resize", fitSidebar);
    return () => window.removeEventListener("resize", fitSidebar);
  }, [fitSidebar]);

  useEffect(() => {
    fitSidebar();
  }, [collapsed, fitSidebar]);

  const q = query.trim().toLowerCase();
  const filteredWorkspaces = WORKSPACES.filter((w) => !q || w.name.toLowerCase().includes(q));
  const filteredSites = SITES.filter((s) => !q || s.name.toLowerCase().includes(q));
  const anyHit = filteredWorkspaces.length > 0 || filteredSites.length > 0;

  // renderOverviewSwitcher(): keep the site selection valid, and default it to
  // the first site the way the standalone file does.
  useEffect(() => {
    if (!SITES.length) {
      setActiveSiteId(null);
      return;
    }
    if (!activeSiteId || !SITES.some((s) => s.id === activeSiteId)) setActiveSiteId(SITES[0].id);
  }, [activeSiteId, SITES]);

  const selectWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    setSwitcherOpen(false);
    setQuery("");
    try {
      window.localStorage.setItem("dr-current-workspace", id);
    } catch {
      /* private mode */
    }
  };
  const selectSite = (id: string) => {
    setActiveSiteId(id);
    setSwitcherOpen(false);
    setQuery("");
  };

  const toggleGroup = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="app">
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="menu-toggle" aria-label="Open menu" aria-controls="sidebar" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Link className="topbar-brand" to="/workspace">
            {DR_LOGO}
            <span>Digital Romanian</span>
          </Link>
        </div>

        <div className="switcher-wrap">
          <button
            ref={swBtnRef}
            className="switcher-btn"
            aria-haspopup="true"
            aria-expanded={switcherOpen}
            aria-controls="switcher-panel"
            onClick={() => setSwitcherOpen((open) => !open)}
          >
            {switcherIco}
            <span className="label" id="switcher-label">{activeWorkspace ? `${activeWorkspace.name} Workspace` : "No workspace"}</span>
            {chevronSvg}
          </button>

          {switcherOpen ? (
            <div className="switcher-panel" id="switcher-panel" ref={swPanelRef}>
              <div className="switcher-scroll" ref={swScrollRef}>
                <div className="switcher-search">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.3333 13.3333L10.5355 10.5355M12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12C9.76142 12 12 9.76142 12 7Z" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <label className="sr-only" htmlFor="switcher-search">Search workspaces and sites</label>
                  <input ref={swSearchRef} id="switcher-search" type="search" placeholder="Search pages, products..." autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>

                <div className="switcher-group">
                  <h2>Workspace</h2>
                  <ul className="switcher-list" data-group="workspace">
                    {filteredWorkspaces.map((w) => (
                      <li key={w.id}>
                        <button className="switcher-item" aria-current={activeWorkspaceId === w.id} data-name={w.name} onClick={() => selectWorkspace(w.id)}>
                          <span className="ico">{w.ico}</span>
                          <span className="name">{w.name}</span>
                          {checkSvg}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {/* data-open="create-ws" and data-open="invite" in the
                      standalone file: both open a dialog, neither navigates. */}
                  <div className="switcher-actions">
                    <button type="button" className="create-site" data-open="create-ws" onClick={() => { setCreateWsOpen(true); setSwitcherOpen(false); }}>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 9H15M9 3V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      Create new workspace
                    </button>
                    {!data.workspaces.length ? null : (
                      <button type="button" className="create-site" data-open="invite" onClick={() => { setInviteOpen(true); setSwitcherOpen(false); }}>
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><use href="#i-user-plus" /></svg>
                        Invite member
                      </button>
                    )}
                      <Form method="post" action="/logout">
                      <button type="submit" className="create-site switcher-signout">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M12 3.75H4.5A1.5 1.5 0 0 0 3 5.25v7.5A1.5 1.5 0 0 0 4.5 14.25H12M8.25 9h6.75M12.75 6.75 15 9l-2.25 2.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        Sign out
                      </button>
                    </Form>
                  </div>
                </div>

                <div className="switcher-group" id="sw-sites-group" hidden={!SITES.length}>
                  <h2>Sites</h2>
                  <ul className="switcher-list" data-group="site">
                    {filteredSites.map((s) => (
                      <li key={s.id}>
                        <button className="switcher-item" aria-current={activeSiteId === s.id} data-name={s.name} onClick={() => selectSite(s.id)}>
                          <span className="ico">
                            <span className="wmark" style={{ "--s": "28px", background: "#b5b2a8" } as React.CSSProperties} aria-hidden="true">
                              {s.name.slice(0, 1).toUpperCase()}
                            </span>
                          </span>
                          <span className="name">{s.name}</span>
                          {checkSvg}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="switcher-empty" hidden={anyHit}>No workspaces or sites match that search.</p>

                <Link to="/workspace" className="create-site" onClick={() => setSwitcherOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 9H15M9 3V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Create new site
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <button className="avatar" aria-label="Account menu">DR</button>
      </header>

      <div className="shell">
        <nav className={`sidebar${menuOpen ? " open" : ""}`} id="sidebar" ref={sidebarRef} aria-label="Main">
          <div className="sidebar-head">
            <Link className="topbar-brand" to="/workspace">
              {DR_LOGO}
              <span>Digital Romanian</span>
            </Link>
            <button className="icon-btn" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <ul className="nav">
            <li>
              <NavLink to="/overview" end className="nav-link" aria-current="page">
                {OVERVIEW_ICON}
                Overview
              </NavLink>
            </li>

            {(["nav-website", "nav-content", "nav-store"] as const).map((id) => {
              const group =
                id === "nav-website" ? { icon: WEBSITE_ICON, label: "Website", items: ["Page", "Template", "Appearance", "Navigation", "SEO"] }
                : id === "nav-content" ? { icon: CONTENT_ICON, label: "Content", items: ["Post", "Collections", "Media", "Forms"] }
                : { icon: STORE_ICON, label: "Store", items: ["Products", "Orders", "Customers"] };
              return (
                <li className="nav-group" key={id}>
                  <button className="nav-group-btn" aria-expanded={!collapsed.has(id)} aria-controls={id} onClick={() => toggleGroup(id)}>
                    {group.icon}
                    {group.label}
                    {chevronSvg}
                  </button>
                  <ul className="nav-sub" id={id} hidden={collapsed.has(id)}>
                    {group.items.map((item) => (
                      <li key={item}><Link to="/overview">{item}</Link></li>
                    ))}
                  </ul>
                </li>
              );
            })}

            <li>
              <a className="nav-link" href="/overview" onClick={(e) => e.preventDefault()}>
                {PUBLISHING_ICON}
                Publishing
              </a>
            </li>
            <li>
              <a className="nav-link" href="/overview" onClick={(e) => e.preventDefault()}>
                {SETTINGS_ICON}
                Settings
              </a>
            </li>
          </ul>
        </nav>

        <main className="main" id="workspace-main">
          <div className="main-heading">
            <h1 tabIndex={-1} className="sr-only">Workspace overview</h1>
          </div>
        </main>
      </div>

      <div className={`scrim${menuOpen ? " show" : ""}`} onClick={() => setMenuOpen(false)} />

      <CreateWorkspaceDialog open={createWsOpen} onClose={() => setCreateWsOpen(false)} actionResult={actionResult} />
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        workspace={activeWorkspace}
        knownPeople={data.directory}
        actionResult={actionResult}
      />
      {toast ? (
        <Toast
          text={toast.text}
          {...(toast.label
            ? { link: { label: toast.label, onClick: () => { setToast(null); if (toast.href) window.location.assign(toast.href); } } }
            : {})}
        />
      ) : null}
    </div>
  );
}