import { useCallback, useEffect, useRef, useState } from "react";

import { useLatestRef } from "./useLatestRef";

export type NotesSaveState = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * A unit's battle note saved as it is typed (the per-unit notes step 6 left out, as main's
 * `useUnitNotesAutosave` saved them): a second after the last keystroke only the latest text is
 * sent, and anything still waiting is sent at once when the editor closes (unmounts), so nothing
 * typed is lost. The state says where the latest save stands.
 */
export function useNotesAutosave(onSave: (notes: string) => Promise<unknown>, delay = 1000) {
  const [saveState, setSaveState] = useState<NotesSaveState>("idle");
  const save = useLatestRef(onSave);
  const timer = useRef<number | undefined>(undefined);
  const waiting = useRef<string | null>(null);
  const sequence = useRef(0);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const notes = waiting.current;
    if (notes === null) return;
    waiting.current = null;
    const mine = ++sequence.current;
    setSaveState("saving");
    save.current(notes).then(
      () => sequence.current === mine && setSaveState("saved"),
      () => sequence.current === mine && setSaveState("error")
    );
  }, [save]);

  const change = useCallback(
    (notes: string) => {
      waiting.current = notes;
      setSaveState("pending");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, delay);
    },
    [delay, flush]
  );

  useEffect(() => flush, [flush]);

  return { saveState, change, flush };
}
