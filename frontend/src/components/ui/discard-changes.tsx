import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/*
 * "Discard changes?" before a long form closes with what was typed in it unsaved (William, 5 Nov
 * 2026: any form with more than 8 inputs, in a drawer, sheet or dialog). A form knows it is dirty
 * from a snapshot of its state taken when it (re)loads; a form of several parts (the template
 * editor's sections) has each part report into the drawer's registry. Short forms don't ask.
 */

/** Whether `state` has moved since the last `markClean()` (called where the form loads an entry). */
export function useDirtySince(state: unknown) {
  const now = JSON.stringify(state);
  const [clean, setClean] = useState(now);
  const [marking, setMarking] = useState(false);
  // the snapshot is taken on the render that has the loaded state (React's "adjust state on render")
  if (marking) {
    setMarking(false);
    setClean(now);
  }
  const markClean = useCallback(() => setMarking(true), []);
  return { dirty: !marking && now !== clean, markClean };
}

/**
 * Closing that asks first while `dirty`: `close()` closes straight away when nothing changed,
 * else opens the confirm (Discard closes, Keep editing stays); render `confirm` beside the form.
 */
export function useDiscardChanges({ dirty, onClose }: { dirty: boolean; onClose: () => void }) {
  const [asking, setAsking] = useState(false);
  const close = () => (dirty ? setAsking(true) : onClose());
  const confirm = (
    <ConfirmDialog
      open={asking}
      onOpenChange={setAsking}
      title="Discard changes?"
      description="What you changed here isn't saved and is lost."
      confirmText="Discard"
      cancelText="Keep editing"
      onConfirm={() => {
        setAsking(false);
        onClose();
      }}
    />
  );
  return { close, confirm };
}

type Registry = { report: (key: string, dirty: boolean) => void };
const DirtyRegistryContext = createContext<Registry | null>(null);

/**
 * A drawer or sheet holding a form of several parts: whether any part reports changes, and the
 * registry its parts report into (`<DirtyRegistry value>` around them, `useReportDirty` in each).
 */
export function useDirtyRegistry() {
  const [dirtyKeys, setDirtyKeys] = useState<ReadonlySet<string>>(() => new Set());
  const report = useCallback((key: string, dirty: boolean) => {
    setDirtyKeys((keys) => {
      if (keys.has(key) === dirty) return keys;
      const next = new Set(keys);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ report }), [report]);
  return { dirty: dirtyKeys.size > 0, value };
}

export function DirtyRegistry({ value, children }: { value: Registry; children: ReactNode }) {
  return <DirtyRegistryContext.Provider value={value}>{children}</DirtyRegistryContext.Provider>;
}

/** A part of a form reports whether it holds changes (none once it goes). */
export function useReportDirty(dirty: boolean) {
  const registry = useContext(DirtyRegistryContext);
  const key = useId();
  useEffect(() => {
    registry?.report(key, dirty);
  }, [registry, key, dirty]);
  useEffect(() => () => registry?.report(key, false), [registry, key]);
}
