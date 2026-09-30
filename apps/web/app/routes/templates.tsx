import { SoonView } from "~/components/workspace-soon";

/* /templates - the data-view="templates" row in .wsd-nav. A child of the
   pathless workspace layout, so the shell and the workspace switcher are the
   same instance the /workspace screen uses. */

export default function WorkspaceTemplates() {
  return <SoonView view="templates" />;
}
