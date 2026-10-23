/**
 * The exploration inputs select their value when they take focus, a frame later. A React event's
 * currentTarget is gone by then, so the field is held from the handler; reading it in the frame
 * threw "Cannot read properties of null (reading 'select')" on every focus (browser QA of
 * release/p5-p6, on the postbattle page).
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExplorationState } from "@/features/battles/hooks/useExploration";
import { postbattleRules } from "@/test/battle-fixtures";
import ExplorationSection from "./ExplorationSection";

vi.mock("@/components/dice/DiceRoller", () => ({ default: () => null }));

let frames: FrameRequestCallback[] = [];

beforeEach(() => {
  frames = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderSection() {
  const explore = {
    exploration: {
      diceCount: 2,
      diceValues: [3, 5],
      selectedDice: [true, true],
      hasRolledAllDice: true,
      amountOverride: null,
      resourceId: null,
    },
    setExploration: vi.fn(),
    isRolling: false,
    limits: { max: 10, max_chosen: 6 },
    rules: postbattleRules(),
    amountFromDice: 1,
    rerollIndex: null,
    commitDiceCount: vi.fn(),
    rollAll: vi.fn(),
    reroll: vi.fn(),
    rollSignal: 0,
    rerollSignal: 0,
    completeRoll: vi.fn(),
    completeReroll: vi.fn(),
    setIsRolling: vi.fn(),
  } as unknown as ExplorationState;
  render(
    <ExplorationSection
      isMobile={false}
      explore={explore}
      resources={[]}
      isFinalized={false}
      isSavingDraft={false}
      draftError=""
      diceColor="#ffffff"
    />
  );
}

/** Focuses the field, then runs the frame it asked for. */
function focusAndRunFrame(input: HTMLInputElement) {
  act(() => input.focus());
  expect(frames.length).toBeGreaterThan(0);
  expect(() => frames.forEach((frame) => frame(0))).not.toThrow();
}

describe("the exploration inputs select their value on focus", () => {
  it("selects the dice count a frame after it takes focus", () => {
    renderSection();
    const diceCount = screen.getByLabelText("Dice Count") as HTMLInputElement;

    focusAndRunFrame(diceCount);

    expect(diceCount.value).toBe("2");
    expect(diceCount.selectionStart).toBe(0);
    expect(diceCount.selectionEnd).toBe(1);
  });

  it("selects a die's value a frame after it takes focus", () => {
    renderSection();
    const die = screen.getByDisplayValue("5") as HTMLInputElement;

    focusAndRunFrame(die);

    expect(die.selectionStart).toBe(0);
    expect(die.selectionEnd).toBe(1);
  });
});
