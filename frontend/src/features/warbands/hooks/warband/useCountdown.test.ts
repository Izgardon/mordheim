import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatCountdown, useCountdown } from "./useCountdown";

describe("formatCountdown", () => {
  it("writes minutes and seconds, rounding a part second up", () => {
    expect(formatCountdown(600_000)).toBe("10:00");
    expect(formatCountdown(61_500)).toBe("1:02");
    expect(formatCountdown(9_000)).toBe("0:09");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-5)).toBe("0:00");
  });
});

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks every second and starts again from a later deadline", () => {
    const { result, rerender } = renderHook(({ deadline }) => useCountdown(deadline), {
      initialProps: { deadline: "2026-10-18T12:05:00Z" as string | null },
    });
    expect(result.current).toBe(300_000);

    act(() => vi.advanceTimersByTime(3_000));
    expect(result.current).toBe(297_000);

    rerender({ deadline: "2026-10-18T12:10:03Z" });
    expect(result.current).toBe(600_000);

    rerender({ deadline: null });
    expect(result.current).toBeNull();
  });

  it("stops at zero", () => {
    const { result } = renderHook(() => useCountdown("2026-10-18T12:00:02Z"));

    act(() => vi.advanceTimersByTime(5_000));

    expect(result.current).toBe(0);
  });
});
