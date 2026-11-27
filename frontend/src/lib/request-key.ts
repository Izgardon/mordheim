import { useMemo, useRef } from "react";

/**
 * Gold-moving writes (a purchase, a hire, a roster Save) send a request key, so one whose answer
 * was lost on weak signal and is sent again is answered again rather than bought twice (the
 * server's `services/request_keys.py`). Needs `idempotency-key` in the backend's
 * CORS_ALLOW_HEADERS (it is).
 */
export const REQUEST_KEY_HEADER = "Idempotency-Key";

/** 32 random hex characters. `getRandomValues` works off https too, unlike `randomUUID`. */
export function newRequestKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The header for `key`, beside any others a write sends. */
export function requestKeyHeaders(key: string | undefined, headers?: Record<string, string>) {
  return key ? { ...headers, [REQUEST_KEY_HEADER]: key } : headers;
}

/**
 * One key per attempt: the same body sent again (Save tapped after a timeout) reuses it; a changed
 * body, or a send after `done()` (the last one succeeded), is a new attempt with a new key.
 */
export function useRequestKey() {
  const last = useRef<{ body: string; key: string } | null>(null);
  return useMemo(
    () => ({
      keyFor(body: unknown) {
        const text = JSON.stringify(body);
        if (last.current?.body !== text) last.current = { body: text, key: newRequestKey() };
        return last.current.key;
      },
      done() {
        last.current = null;
      },
    }),
    []
  );
}
