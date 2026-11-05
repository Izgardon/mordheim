import { cleanup, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BattlePostbattleRules,
  BattlePostbattleState,
  BattlePostbattleSuggestion,
} from "@/features/battles/types/battle-types";
import { rollDie } from "@/lib/dice";
import { postbattleRules } from "@/test/battle-fixtures";
import { setupUser } from "@/test/user-event";

import InjuriesTab from "./InjuriesTab";

vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: vi.fn(),
}));

const robbed = {
  roll_type: "d66",
  rolls: [3, 6],
  result_code: "36",
  result_label: "Robbed",
  dead_suggestion: false,
  effect: { kind: "manual" },
} as const;

const hero = {
  unit_name: "Dieter Brandt",
  unit_type: "Champion",
  unit_kind: "hero",
  out_of_action: true,
  kill_count: 0,
  xp_earned: 0,
  dead: false,
  special_ids: [],
  serious_injury_rolls: [],
  advances: [],
};

const draftOf = (result: Record<string, unknown> = {}) =>
  ({
    unit_results: { "hero:1": { ...hero, ...result } },
    mount_survival: {},
  }) as unknown as BattlePostbattleState;

const draft = draftOf({ serious_injury_rolls: [robbed] });

const base = postbattleRules();
const rules: BattlePostbattleRules = {
  ...base,
  injury_tables: {
    ...base.injury_tables,
    d66: [
      ...(base.injury_tables.d66 ?? []),
      {
        low: 36,
        high: 36,
        label: "Robbed",
        effect: { kind: "manual" },
        text: "He gets away with nothing he carried.",
      },
      {
        low: 61,
        high: 61,
        label: "Hand Injury",
        effect: { kind: "manual", misses: { games: 0, dice: "D3" } },
      },
    ],
  },
};

const show = (
  shown: BattlePostbattleState,
  options: { rules?: BattlePostbattleRules; suggestion?: BattlePostbattleSuggestion } = {}
) => {
  const onChange = vi.fn();
  render(
    <InjuriesTab
      draft={shown}
      roster={undefined}
      rules={options.rules ?? rules}
      suggestion={options.suggestion}
      isMobile={false}
      onChange={onChange}
    />
  );
  return onChange;
};

const card = (heading: string) =>
  screen.getByRole("heading", { name: heading }).closest("article") as HTMLElement;
const changed = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls[onChange.mock.calls.length - 1][0] as BattlePostbattleState;

describe("InjuriesTab", () => {
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
  });

  it("gives a rolled result its book line and no line about mounts nobody lost", () => {
    show(draft);
    expect(screen.getByRole("heading", { name: "Dieter Brandt" })).toBeInTheDocument();
    expect(screen.getByText("He gets away with nothing he carried.")).toBeInTheDocument();
    expect(screen.queryByText(/No mount was lost/)).toBeNull();
  });

  it("takes a D66 typed in, tens then units, as the same draft Roll gives for those faces", async () => {
    const user = setupUser();
    const typed = show(draftOf());
    await user.type(screen.getByLabelText("First D6 rolled"), "2");
    await user.keyboard("4");
    const result = changed(typed).unit_results["hero:1"];
    expect(result.serious_injury_rolls).toEqual([
      expect.objectContaining({ rolls: [2, 4], result_code: "24", result_label: "Horrible Scars" }),
    ]);

    vi.mocked(rollDie).mockReturnValueOnce(2).mockReturnValueOnce(4);
    cleanup();
    const rolled = show(draftOf());
    await user.click(screen.getByRole("button", { name: "Roll D66" }));
    expect(changed(rolled)).toEqual(changed(typed));
  });

  it("takes a D100 typed in", async () => {
    const user = setupUser();
    const onChange = show(draftOf(), { rules: { ...rules, hero_death_roll: "d100" } });
    await user.type(screen.getByLabelText("D100 rolled"), "30");
    expect(changed(onChange).unit_results["hero:1"].serious_injury_rolls[0]).toMatchObject({
      rolls: [30],
      result_label: "Chest Wound",
    });
  });

  it("rolls a typed result's missing games as Roll does, and takes them typed over", async () => {
    vi.mocked(rollDie).mockReturnValueOnce(2);
    const user = setupUser();
    const onChange = show(draftOf());
    await user.type(screen.getByLabelText("First D6 rolled"), "6");
    await user.keyboard("1");
    expect(rollDie).toHaveBeenCalledWith(3);
    const injured = changed(onChange);
    expect(injured.unit_results["hero:1"].missing_games).toEqual({
      games: 2,
      reason: "Hand Injury",
    });

    cleanup();
    const again = show(injured);
    expect(screen.getByLabelText("D3 rolled")).toHaveValue("2");
    await user.type(screen.getByLabelText("D3 rolled"), "3");
    expect(changed(again).unit_results["hero:1"].missing_games).toEqual({
      games: 3,
      reason: "Hand Injury",
    });
  });

  it("takes a mount's D6 typed in", async () => {
    const user = setupUser();
    const suggestion = {
      mount_survival: {
        entries: { "hero:1": { unit_name: "Dieter Brandt", mount: "Warhorse", dies_on: 2 } },
      },
    } as unknown as BattlePostbattleSuggestion;
    const onChange = show(draft, { suggestion });
    await user.type(within(card("Warhorse")).getByLabelText("D6 rolled"), "2");
    expect(changed(onChange).mount_survival).toEqual({ "hero:1": { roll: 2, dead: true } });
    expect(rollDie).not.toHaveBeenCalled();
  });
});
