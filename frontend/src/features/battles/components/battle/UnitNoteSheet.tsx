import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { useNotesAutosave, type NotesSaveState } from "@/features/battles/hooks/useNotesAutosave";

/** The server keeps a unit's battle note to 500 characters. */
export const UNIT_NOTE_MAX = 500;

/** The unit whose note is open: its unit key, name and note as cached when it opened. */
export type NoteTarget = { key: string; name: string; notes: string };

const STATE_TEXT: Record<NotesSaveState, string> = {
  idle: "",
  pending: "Saving…",
  saving: "Saving…",
  saved: "Saved",
  error: "Not saved. Keep typing to try again.",
};

function NoteEditor({
  target,
  readOnly,
  onSave,
}: {
  target: NoteTarget;
  readOnly: boolean;
  onSave: (unitKey: string, notes: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(target.notes);
  const { saveState, change } = useNotesAutosave((notes) => onSave(target.key, notes));
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        aria-label={`Note for ${target.name}`}
        value={draft}
        readOnly={readOnly}
        maxLength={UNIT_NOTE_MAX}
        rows={5}
        placeholder="Anything to remember about this unit in this battle"
        onChange={(event) => {
          setDraft(event.target.value);
          change(event.target.value);
        }}
        className="w-full border border-strong bg-page p-3 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-center justify-between gap-2 text-xs">
        <span
          role="status"
          className={saveState === "error" ? "text-danger" : "text-muted-foreground"}
        >
          {STATE_TEXT[saveState]}
        </span>
        <span className="font-mono text-faint">
          {draft.length}/{UNIT_NOTE_MAX}
        </span>
      </div>
    </div>
  );
}

/**
 * One of your units' battle notes (per-unit notes, back from before step 6): a box that saves as
 * you type, for this battle only. Only you see it. A modal, or a sheet on a phone.
 */
export default function UnitNoteSheet({
  target,
  readOnly,
  onOpenChange,
  onSave,
}: {
  target: NoteTarget | null;
  readOnly: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (unitKey: string, notes: string) => Promise<unknown>;
}) {
  return (
    <ModalSheet
      open={target !== null}
      onOpenChange={onOpenChange}
      kicker="Only you see this"
      title={target ? `Note · ${target.name}` : "Note"}
      className="max-w-[480px]"
      footer={
        <Button className="min-h-12 w-full" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      {target ? (
        <NoteEditor key={target.key} target={target} readOnly={readOnly} onSave={onSave} />
      ) : null}
    </ModalSheet>
  );
}
