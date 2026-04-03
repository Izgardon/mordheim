import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useExperienceBar } from "../useExperienceBar";

import type { LevelInfo } from "@/features/warbands/components/heroes/utils/hero-level";

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({
    campaignStarted: true,
  }),
}));

const getLevelInfo = (xp: number): LevelInfo => {
  if (xp >= 5) {
    return {
      level: 2,
      nextLevelAt: 10,
      gap: 5,
      currentLevelAt: 5,
    };
  }

  return {
    level: 1,
    nextLevelAt: 5,
    gap: 5,
    currentLevelAt: 0,
  };
};

describe("useExperienceBar", () => {
  it("resyncs local xp state when the prop changes after mount", async () => {
    const onSave = vi.fn(async (xp: number) => xp);

    const { result, rerender } = renderHook(
      ({ xp }) =>
        useExperienceBar({
          xp,
          getLevelInfo,
          onSave,
        }),
      {
        initialProps: {
          xp: null as number | null,
        },
      }
    );

    expect(result.current.xp).toBe(0);
    expect(result.current.label).toBe("0 / 5 xp");

    rerender({ xp: 7 });

    await waitFor(() => {
      expect(result.current.xp).toBe(7);
      expect(result.current.label).toBe("7 / 10 xp");
    });
  });
});
