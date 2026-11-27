import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { newRequestKey, requestKeyHeaders, useRequestKey } from "./request-key";

describe("request keys", () => {
  it("makes a fresh 32-character key each time", () => {
    const key = newRequestKey();
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(newRequestKey()).not.toBe(key);
  });

  it("adds the header beside the others, and nothing without a key", () => {
    expect(requestKeyHeaders("abc12345", { "X-Pusher-Socket-Id": "1.2" })).toEqual({
      "X-Pusher-Socket-Id": "1.2",
      "Idempotency-Key": "abc12345",
    });
    expect(requestKeyHeaders(undefined, { "X-Pusher-Socket-Id": "1.2" })).toEqual({
      "X-Pusher-Socket-Id": "1.2",
    });
    expect(requestKeyHeaders(undefined)).toBeUndefined();
  });

  it("keeps a key while the same body is sent again, and starts afresh on a change or after done", () => {
    const { result } = renderHook(() => useRequestKey());
    const first = result.current.keyFor({ name: "Ana", price: 35 });

    expect(result.current.keyFor({ name: "Ana", price: 35 })).toBe(first);
    const changed = result.current.keyFor({ name: "Ana", price: 40 });
    expect(changed).not.toBe(first);
    result.current.done();
    expect(result.current.keyFor({ name: "Ana", price: 40 })).not.toBe(changed);
  });
});
