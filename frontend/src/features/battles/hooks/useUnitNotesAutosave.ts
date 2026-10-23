import { useEffect, useRef, useState } from "react";

export type NotesSaveState = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * A unit's battle notes as typed, saved a second after the last keystroke (only the latest save
 * counts), with its save state; the server's notes replace the draft when they change.
 */
export function useUnitNotesAutosave({
  sourceNotes,
  unitKey,
  canSave,
  onSaveNotes,
}: {
  sourceNotes: string;
  unitKey: string;
  canSave: boolean;
  onSaveNotes?: (notes: string) => Promise<void> | void;
}) {
  const [draftNotes, setDraftNotes] = useState(sourceNotes);
  const [lastSavedNotes, setLastSavedNotes] = useState(sourceNotes);
  const [saveState, setSaveState] = useState<NotesSaveState>("idle");
  const saveSequenceRef = useRef(0);

  useEffect(() => {
    setDraftNotes(sourceNotes);
    setLastSavedNotes(sourceNotes);
    setSaveState("idle");
  }, [sourceNotes, unitKey]);

  useEffect(() => {
    if (!canSave || !onSaveNotes) {
      return;
    }

    if (draftNotes === lastSavedNotes) {
      return;
    }

    setSaveState("pending");
    const nextSequence = saveSequenceRef.current + 1;
    saveSequenceRef.current = nextSequence;

    const timeoutHandle = window.setTimeout(() => {
      setSaveState("saving");
      Promise.resolve(onSaveNotes(draftNotes))
        .then(() => {
          if (saveSequenceRef.current !== nextSequence) {
            return;
          }
          setLastSavedNotes(draftNotes);
          setSaveState("saved");
          window.setTimeout(() => {
            if (saveSequenceRef.current === nextSequence) {
              setSaveState("idle");
            }
          }, 1200);
        })
        .catch(() => {
          if (saveSequenceRef.current !== nextSequence) {
            return;
          }
          setSaveState("error");
        });
    }, 1000);

    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, [canSave, draftNotes, lastSavedNotes, onSaveNotes]);

  return { draftNotes, setDraftNotes, saveState, setSaveState };
}
