import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { deferred } from "@/test/battle-fixtures";
import { useSerializedSave } from "./useSerializedSave";

/** A server whose answers the test releases one by one, in order. */
function heldServer() {
  const held: Array<{ payload: string; answer: ReturnType<typeof deferred<string>> }> = [];
  const send = vi.fn((payload: string) => {
    const answer = deferred<string>();
    held.push({ payload, answer });
    return answer.promise;
  });
  return { send, held };
}

const renderSave = (send: (payload: string) => Promise<string>, onSaved = vi.fn()) => ({
  onSaved,
  ...renderHook(() => useSerializedSave(send, onSaved)),
});

describe("useSerializedSave (BUG-44)", () => {
  it("sends one save at a time and only the newest of those made meanwhile", async () => {
    const { send, held } = heldServer();
    const { result, onSaved } = renderSave(send);

    let first!: Promise<string | null>, second!: Promise<string | null>;
    let third!: Promise<string | null>;
    act(() => {
      first = result.current.save("a");
      second = result.current.save("b");
      third = result.current.save("c");
    });
    expect(send.mock.calls.map(([payload]) => payload)).toEqual(["a"]);
    await expect(second).resolves.toBeNull();

    await act(async () => held[0].answer.resolve("saved a"));
    expect(send.mock.calls.map(([payload]) => payload)).toEqual(["a", "c"]);
    // "a" answered while "c" waited with newer data: its answer isn't applied.
    expect(onSaved).not.toHaveBeenCalled();
    await expect(first).resolves.toBe("saved a");

    await act(async () => held[1].answer.resolve("saved c"));
    expect(onSaved.mock.calls).toEqual([["saved c"]]);
    await expect(third).resolves.toBe("saved c");
  });

  it("merges the saves made meanwhile when given a merge, instead of keeping only the newest", async () => {
    const { send, held } = heldServer();
    const { result } = renderHook(() =>
      useSerializedSave(send, vi.fn(), { merge: (queued, next) => `${queued}+${next}` })
    );

    act(() => {
      void result.current.save("a");
      void result.current.save("b");
      void result.current.save("c");
    });
    await act(async () => held[0].answer.resolve("ok"));

    expect(send.mock.calls.map(([payload]) => payload)).toEqual(["a", "b+c"]);
  });

  it("keeps a key pending while its save waits in the queue, not just while it is sent", async () => {
    const { send, held } = heldServer();
    const { result } = renderSave(send);

    act(() => {
      void result.current.save("wolf", { keys: ["hero:1"] });
      void result.current.save("rolf", { keys: ["hero:3"] });
      void result.current.save("youngblood", { keys: ["henchman:2"] });
    });
    // The waiting save carries Rolf's change as well as the henchman's.
    expect(result.current.pendingKeys).toEqual({
      "hero:1": true,
      "hero:3": true,
      "henchman:2": true,
    });

    await act(async () => held[0].answer.resolve("ok"));
    expect(result.current.pendingKeys).toEqual({ "hero:3": true, "henchman:2": true });

    await act(async () => held[1].answer.resolve("ok"));
    expect(result.current.pendingKeys).toEqual({});
  });

  it("rejects a failed save to its caller and still sends the next one", async () => {
    const { send, held } = heldServer();
    const { result, onSaved } = renderSave(send);

    let failed!: Promise<string | null>;
    act(() => {
      failed = result.current.save("a");
      void result.current.save("b");
    });
    const rejection = expect(failed).rejects.toThrow("Server error");
    await act(async () => held[0].answer.reject(new Error("Server error")));
    await rejection;

    expect(send).toHaveBeenCalledTimes(2);
    await act(async () => held[1].answer.resolve("saved b"));
    expect(onSaved.mock.calls).toEqual([["saved b"]]);
  });

  it("counts only loud saves as saving", async () => {
    const { send, held } = heldServer();
    const { result } = renderSave(send);

    act(() => {
      void result.current.save("notes", { silent: true });
    });
    expect(result.current.isSaving).toBe(false);

    act(() => {
      void result.current.save("wounds");
    });
    expect(result.current.isSaving).toBe(true);

    await act(async () => held[0].answer.resolve("ok"));
    await act(async () => held[1].answer.resolve("ok"));
    expect(result.current.isSaving).toBe(false);
  });
});
