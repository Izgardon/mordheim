import { useEffect, useLayoutEffect, useRef } from "react";

import { onConnectionRestored, subscribe } from "./client";

/** Keeps the latest callback in a ref, so effects that call it don't resubscribe on each render. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * Subscribes to `event` on `channel` for the component's lifetime; `null` subscribes to nothing.
 * Only a change of channel or event resubscribes: the handler can change freely.
 */
export function useChannel<T = unknown>(
  channel: string | null,
  event: string,
  handler: (data: T) => void
) {
  const handlerRef = useLatest(handler);

  useEffect(() => {
    if (!channel) {
      return;
    }
    return subscribe(channel, event, (data) => handlerRef.current(data as T));
  }, [channel, event, handlerRef]);
}

/** Runs `handler` when the realtime connection comes back after a drop (missed events). */
export function useRealtimeReconnect(handler: () => void) {
  const handlerRef = useLatest(handler);

  useEffect(() => onConnectionRestored(() => handlerRef.current()), [handlerRef]);
}
