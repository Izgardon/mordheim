/**
 * Entering the battle screen (William, 1 Nov 2026): the swords come up at once, stay for one full
 * strike even when the screen is already drawn, and until it is drawn if that takes longer; then
 * they fade out onto it. Reduced motion holds a still frame for a short minimum.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SWORD_CLASH_MS,
  SWORD_CLASH_REDUCED_MS,
  SWORDS_FADE_MS,
} from "@/components/ui/sword-clash";

import { useBattleEntrance } from "./useBattleEntrance";

const reducedMotion = (matches: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: matches && query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList
  );

beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion(false);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useBattleEntrance", () => {
  it("holds the swords for one full strike when the screen is ready at once", () => {
    const { result } = renderHook(() => useBattleEntrance(true));
    expect(result.current.showing).toBe(true);

    act(() => result.current.ready());
    act(() => vi.advanceTimersByTime(SWORD_CLASH_MS - 1));
    expect(result.current).toMatchObject({ showing: true, leaving: false });

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toMatchObject({ showing: true, leaving: true });

    act(() => vi.advanceTimersByTime(SWORDS_FADE_MS));
    expect(result.current.showing).toBe(false);
  });

  it("waits past the strike for a screen that is slower", () => {
    const { result } = renderHook(() => useBattleEntrance(true));

    act(() => vi.advanceTimersByTime(SWORD_CLASH_MS * 3));
    expect(result.current).toMatchObject({ showing: true, leaving: false });

    act(() => result.current.ready());
    expect(result.current.leaving).toBe(true);
    act(() => vi.advanceTimersByTime(SWORDS_FADE_MS));
    expect(result.current.showing).toBe(false);
  });

  it("comes up on the first frame of the battle screen when the pre-battle turns into the fight", () => {
    const { result, rerender } = renderHook(({ entering }) => useBattleEntrance(entering), {
      initialProps: { entering: false },
    });
    expect(result.current.showing).toBe(false);

    rerender({ entering: true });
    expect(result.current.showing).toBe(true);
  });

  it("holds a still frame only briefly with reduced motion", () => {
    reducedMotion(true);
    const { result } = renderHook(() => useBattleEntrance(true));
    act(() => result.current.ready());

    act(() => vi.advanceTimersByTime(SWORD_CLASH_REDUCED_MS));
    expect(result.current.leaving).toBe(true);
  });
});
