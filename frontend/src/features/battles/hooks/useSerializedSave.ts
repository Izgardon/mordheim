import { useCallback, useLayoutEffect, useRef, useState } from "react";

type SaveOptions = {
  /** What the save carries (unit keys); they stay in `pendingKeys` until it has answered. */
  keys?: string[];
  /** Left out of `isSaving`, e.g. a notes autosave that shows its own state. */
  silent?: boolean;
};

type PendingSave<Payload, Result> = {
  payload: Payload;
  keys: string[];
  silent: boolean;
  resolve: (result: Result | null) => void;
  reject: (reason?: unknown) => void;
};

/**
 * Sends saves one at a time (BUG-44). A save made while another is in flight waits; a newer one
 * replaces it, carrying its keys, and the replaced caller gets `null`. An answer is applied
 * (`onSaved`) only when no newer save is waiting, so an older answer never undoes a newer edit on
 * screen. `pendingKeys` covers queued saves as well as the one in flight: a save is built from the
 * state when it was made, so anything else written to those keys before it is sent would be lost.
 */
export function useSerializedSave<Payload, Result>(
  send: (payload: Payload) => Promise<Result>,
  onSaved: (result: Result) => void
) {
  const sendRef = useRef(send);
  const onSavedRef = useRef(onSaved);
  useLayoutEffect(() => {
    sendRef.current = send;
    onSavedRef.current = onSaved;
  });

  const queuedRef = useRef<PendingSave<Payload, Result> | null>(null);
  const inFlightRef = useRef<PendingSave<Payload, Result> | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  const syncStatus = useCallback(() => {
    const pending = [inFlightRef.current, queuedRef.current].filter(
      (entry): entry is PendingSave<Payload, Result> => entry !== null
    );
    setPendingKeys(
      Object.fromEntries(pending.flatMap((entry) => entry.keys).map((key) => [key, true]))
    );
    setIsSaving(pending.some((entry) => !entry.silent));
  }, []);

  const flush = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    while (queuedRef.current) {
      const current = queuedRef.current;
      queuedRef.current = null;
      inFlightRef.current = current;
      syncStatus();
      try {
        const result = await sendRef.current(current.payload);
        if (!queuedRef.current) {
          onSavedRef.current(result);
        }
        current.resolve(result);
      } catch (error) {
        current.reject(error);
      } finally {
        inFlightRef.current = null;
      }
    }
    syncStatus();
  }, [syncStatus]);

  const save = useCallback(
    (payload: Payload, { keys = [], silent = false }: SaveOptions = {}) =>
      new Promise<Result | null>((resolve, reject) => {
        const replaced = queuedRef.current;
        replaced?.resolve(null);
        queuedRef.current = {
          payload,
          keys: replaced ? Array.from(new Set([...replaced.keys, ...keys])) : keys,
          silent: silent && (replaced?.silent ?? true),
          resolve,
          reject,
        };
        syncStatus();
        void flush();
      }),
    [flush, syncStatus]
  );

  return { save, pendingKeys, isSaving };
}
