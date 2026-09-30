/* The Templates, Team and General settings views. The standalone file's
   renderDashboard() renders exactly this for all three (its SOON map), so the
   markup and copy are identical. The only reason these are separate route
   files rather than one shared component is that each needs its own title in
   the router. */

import { SOON, type SoonViewKey } from "~/lib/soon";

export function SoonView({ view }: { view: SoonViewKey }) {
  const [title, text] = SOON[view];
  return (
    <>
      <div className="wsd-head">
        <div>
          <h1 tabIndex={-1}>{title}</h1>
        </div>
      </div>
      <div className="soon">
        <span className="soon-tag">Coming soon</span>
        <h2>{title} is on its way</h2>
        <p>{text}</p>
      </div>
    </>
  );
}
