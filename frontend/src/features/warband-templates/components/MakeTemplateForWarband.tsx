import { useState } from "react";

import TemplateEditor from "../editor/TemplateEditor";
import MakeTemplateDialog from "./MakeTemplateDialog";

/**
 * A warband page's "Make a template for <type>" (the templates plan, phase 4), beside Add hero
 * while its type has no template: made blank or as a copy, then edited in the editor here. Its
 * next recruits read it; nothing on the roster changes.
 */
export default function MakeTemplateForWarband({
  campaignId,
  warbandType,
  hasTemplate,
}: {
  campaignId: number;
  warbandType: { id: number; name: string };
  /** The type has a template now: the button goes, an editor already open stays. */
  hasTemplate: boolean;
}) {
  const [making, setMaking] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <>
      {hasTemplate ? null : (
        <button
          type="button"
          onClick={() => setMaking(true)}
          className="min-h-9 px-2 text-[13px] font-semibold text-accent-text underline-offset-2 hover:underline"
        >
          Make a template for {warbandType.name}
        </button>
      )}
      {making ? (
        <MakeTemplateDialog
          open
          onOpenChange={setMaking}
          campaignId={campaignId}
          forType={warbandType}
          onMade={setEditing}
        />
      ) : null}
      <TemplateEditor
        campaignId={campaignId}
        templateId={editing}
        onTemplateChange={setEditing}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
