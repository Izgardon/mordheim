import { Button } from "@/components/ui/button";
import { TEXTAREA } from "@/features/catalogue/components/form-layout";

import type { UnitEditDraft } from "./useUnitEditDraft";

/** As the server caps a unit's notes. */
export const MAX_NOTES = 2000;

/** The unit's notes, opened from the form's Notes button and kept with the draft, which Save sends. */
export default function EditNotes({ form, onDone }: { form: UnitEditDraft; onDone: () => void }) {
  const { draft, set } = form;
  return (
    <div className="flex flex-col gap-2 border border-border bg-raised p-2.5">
      <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
        Notes
        <textarea
          autoFocus
          maxLength={MAX_NOTES}
          className={TEXTAREA}
          value={String(draft.notes ?? "")}
          onChange={(event) => set("notes", event.target.value)}
        />
      </label>
      <Button size="sm" variant="secondary" className="self-start" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
