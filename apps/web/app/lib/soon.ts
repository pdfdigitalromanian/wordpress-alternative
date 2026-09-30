/* The SOON map, verbatim from digital-romanian-screens.html's renderDashboard:
   "Templates, Team and General settings are empty for now: title only". */

export const SOON = {
  templates: [
    "Templates",
    "Save pages and sections as templates and reuse them across every site in this workspace.",
  ],
  team: [
    "Team",
    "See everyone in this workspace, their roles and pending invitations, all in one place.",
  ],
  settings: [
    "General settings",
    "Edit your workspace name, logo and URL, and manage other workspace preferences.",
  ],
} as const;

/** The three sidebar views that render the "Coming soon" panel. */
export type SoonViewKey = keyof typeof SOON;
