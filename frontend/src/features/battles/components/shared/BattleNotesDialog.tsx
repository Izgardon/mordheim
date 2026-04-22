import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BattleNotesDialogProps = {
  open: boolean;
  notes: string;
  onOpenChange: (open: boolean) => void;
  onSave: (notes: string) => Promise<void> | void;
};

export default function BattleNotesDialog({
  open,
  notes,
  onOpenChange,
  onSave,
}: BattleNotesDialogProps) {
  const [draftNotes, setDraftNotes] = useState(notes);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const normalizedNotes = useMemo(() => notes.trim(), [notes]);
  const normalizedDraftNotes = useMemo(() => draftNotes.trim(), [draftNotes]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftNotes(notes);
    setError("");
    setIsSaving(false);
  }, [notes, open]);

  const handleRequestClose = async () => {
    if (isSaving) {
      return;
    }
    if (normalizedDraftNotes === normalizedNotes) {
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await onSave(normalizedDraftNotes);
      onOpenChange(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to save battle notes");
      } else {
        setError("Unable to save battle notes");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true);
          return;
        }
        void handleRequestClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Battle Notes</DialogTitle>
          <DialogDescription>
            Keep participant-specific notes for prebattle, active battle, and postbattle.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="battle-inline-panel overflow-hidden border border-[#5a3f24] bg-[#130d09] shadow-none">
            <textarea
              value={draftNotes}
              onChange={(event) => setDraftNotes(event.target.value)}
              disabled={isSaving}
              rows={10}
              className="block min-h-[14rem] w-full resize-y border-0 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0"
              placeholder="Add battle notes..."
              aria-label="Battle Notes"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => void handleRequestClose()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
