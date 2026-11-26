/**
 * William, 26 Nov 2026: taps on a unit's status cycle it at once and only where it ends up goes to
 * the server, once the taps stop.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STATUS_BUFFER_MS, useBufferedStatus } from "./useBufferedStatus";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useBufferedStatus", () => {
  it("shows each tap at once and sends one request for the last, after the taps stop", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useBufferedStatus(send));

    act(() => result.current.cycle("hero:1", "standing"));
    act(() => result.current.cycle("hero:1", "standing"));
    act(() => result.current.cycle("hero:1", "standing"));
    expect(result.current.statusOf("hero:1", "standing")).toBe("out_of_action");
    expect(send).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_BUFFER_MS);
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("hero:1", "standing", "out_of_action");
    expect(result.current.statusOf("hero:1", "standing")).toBe("standing"); // the server's from here
  });

  it("waits again after every tap", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useBufferedStatus(send));

    act(() => result.current.cycle("hero:1", "standing"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_BUFFER_MS - 100);
    });
    act(() => result.current.cycle("hero:1", "standing"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_BUFFER_MS - 100);
    });
    expect(send).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(send).toHaveBeenCalledWith("hero:1", "standing", "stunned");
  });

  it("sends nothing when the taps come back round to where they started", async () => {
    const send = vi.fn();
    const { result } = renderHook(() => useBufferedStatus(send));

    for (let tap = 0; tap < 4; tap += 1) act(() => result.current.cycle("hero:1", "stunned"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_BUFFER_MS);
    });

    expect(send).not.toHaveBeenCalled();
  });

  it("sends what is waiting when the page is left", () => {
    const send = vi.fn();
    const { result, unmount } = renderHook(() => useBufferedStatus(send));

    act(() => result.current.cycle("hero:1", "standing"));
    unmount();

    expect(send).toHaveBeenCalledWith("hero:1", "standing", "knocked_down");
  });
});
