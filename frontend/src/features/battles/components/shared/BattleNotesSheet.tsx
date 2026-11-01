import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";

type BattleNotesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: string;
  /** Saves your battle notes (yours alone: nobody else reads them). */
  onSave: (notes: string) => Promise<void>;
};

/** Your notes for this battle: the scenario, objectives, house rules. A modal, or a sheet on a phone. */
export default function BattleNotesSheet({
  open,
  onOpenChange,
  notes,
  onSave,
}: BattleNotesSheetProps) {
  const [draft, setDraft] = useState(notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setDraft(notes);
      setError("");
    }
  }, [notes, open]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(draft.trim());
      onOpenChange(false);
    } catch (failure) {
      setError(getErrorMessage(failure, "Couldn't save your notes."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker="Only you see these"
      title="Battle notes"
      footer={
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="min-h-12" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save notes"}
          </Button>
        </div>
      }
    >
      <textarea
        aria-label="Battle notes"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={8}
        placeholder="Battle notes"
        className="w-full border border-strong bg-page p-3 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </ModalSheet>
  );
}
