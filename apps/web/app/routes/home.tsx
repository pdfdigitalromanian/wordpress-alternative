import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Digital Romanian CMS" },
    {
      name: "description",
      content:
        "Digital Romanian CMS platform shell. Admin, editor, and public site rendering are implemented in later milestones.",
    },
  ];
}

export default function Home() {
  return (
    <main>
      <h1>Digital Romanian CMS</h1>
      <p>
        This route confirms the application renders real server-side HTML.
        The admin dashboard, visual editor, and site-resolved public
        rendering are implemented in subsequent milestones.
      </p>
    </main>
  );
}
