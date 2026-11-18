/**
 * The battle's transient "just changed" marks (William, 12 Nov 2026, item 10): brief, one per
 * model however often its status is cycled, and gone on their own.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STATUS_MARK_MS, useRecentStatus } from "./use-recent-status";

type Entries = readonly (readonly [string, string])[];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useRecentStatus", () => {
  it("marks nobody on the first read, then the model whose status changed", () => {
    const { result, rerender } = renderHook(
      ({ statuses }: { statuses: Entries }) => useRecentStatus(statuses),
      { initialProps: { statuses: [["hero:1", "standing"] as const] as Entries } }
    );

    expect([...result.current]).toEqual([]);

    rerender({ statuses: [["hero:1", "knocked_down"] as const] });
    expect([...result.current]).toEqual(["hero:1"]);

    act(() => void vi.advanceTimersByTime(STATUS_MARK_MS + 10));
    expect([...result.current]).toEqual([]);
  });

  it("keeps one mark through a status cycled three times quickly", () => {
    const { result, rerender } = renderHook(
      ({ statuses }: { statuses: Entries }) => useRecentStatus(statuses),
      { initialProps: { statuses: [["hero:1", "standing"] as const] as Entries } }
    );

    for (const status of ["knocked_down", "stunned", "out_of_action"]) {
      rerender({ statuses: [["hero:1", status] as const] });
      act(() => void vi.advanceTimersByTime(100));
    }
    expect([...result.current]).toEqual(["hero:1"]);

    // the last change started the life over: the mark is still there just before it ends
    act(() => void vi.advanceTimersByTime(STATUS_MARK_MS - 200));
    expect([...result.current]).toEqual(["hero:1"]);
    act(() => void vi.advanceTimersByTime(300));
    expect([...result.current]).toEqual([]);
  });

  it("leaves a model that has only just joined the fight unmarked", () => {
    const { result, rerender } = renderHook(
      ({ statuses }: { statuses: Entries }) => useRecentStatus(statuses),
      { initialProps: { statuses: [["hero:1", "standing"] as const] as Entries } }
    );

    rerender({
      statuses: [["hero:1", "standing"] as const, ["henchman:2", "standing"] as const],
    });
    expect([...result.current]).toEqual([]);

    rerender({
      statuses: [["hero:1", "standing"] as const, ["henchman:2", "stunned"] as const],
    });
    expect([...result.current]).toEqual(["henchman:2"]);
  });
});
