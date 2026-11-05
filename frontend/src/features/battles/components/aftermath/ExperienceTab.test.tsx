import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BattlePostbattleState } from "@/features/battles/types/battle-types";
import { rollDie } from "@/lib/dice";
import { setupUser } from "@/test/user-event";

import { rollAdvance, withFollowUp, type XpRow } from "./aftermath-xp";
import ExperienceTab from "./ExperienceTab";

vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: vi.fn(),
}));

const row = (advances: XpRow["advances"] = []): XpRow => ({
  key: "hero:1",
  resultKeys: ["hero:1"],
  name: "Dieter Brandt",
  type: "Champion",
  group: false,
  from: 4,
  earned: 2,
  to: 6,
  halfRate: false,
  canGainXp: true,
  reasons: "Survived +1 · Kill +1",
  thresholds: [2, 4, 6, 8],
  advances,
});

const draft = {
  unit_results: { "hero:1": { unit_name: "Dieter Brandt", unit_kind: "hero", advances: [] } },
} as unknown as BattlePostbattleState;

const show = (shown: XpRow) => {
  const onChange = vi.fn();
  render(<ExperienceTab draft={draft} rows={[shown]} isMobile={false} onChange={onChange} />);
  return onChange;
};
const advancesOf = (onChange: ReturnType<typeof vi.fn>) =>
  (onChange.mock.calls[onChange.mock.calls.length - 1][0] as BattlePostbattleState).unit_results[
    "hero:1"
  ].advances;

describe("rollAdvance and withFollowUp", () => {
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
  });

  it("read the table for the 2D6 given, rolling a hero's follow-up D6", () => {
    vi.mocked(rollDie).mockReturnValueOnce(2);
    expect(rollAdvance(false, 6, [4, 4])).toEqual({
      id: "I",
      label: "+1 Initiative",
      at: 6,
      rolls: [4, 4, 2],
    });
    expect(rollAdvance(false, 6, [3, 4])).toMatchObject({ id: "WS", rolls: [3, 4] });
    expect(rollAdvance(true, 6, [5, 6])).toMatchObject({ id: "LGT", rolls: [5, 6] });
    expect(rollDie).toHaveBeenCalledTimes(1);
  });

  it("let the follow-up D6 change, and the stat with it", () => {
    const advance = { id: "I", label: "+1 Initiative", at: 6, rolls: [4, 4, 2] };
    expect(withFollowUp(advance, 5)).toEqual({
      id: "Ld",
      label: "+1 Leadership",
      at: 6,
      rolls: [4, 4, 5],
    });
  });
});

describe("ExperienceTab", () => {
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
  });

  it("takes the advance's 2D6 typed in, as Roll would with those faces", async () => {
    const user = setupUser();
    const onChange = show(row());
    await user.type(screen.getByLabelText("First D6 rolled"), "3");
    await user.keyboard("4");
    expect(advancesOf(onChange)).toEqual([
      { id: "WS", label: "+1 Weapon Skill", at: 6, rolls: [3, 4] },
    ]);
    expect(rollDie).not.toHaveBeenCalled();
  });

  it("shows a hero's follow-up D6 in its box and takes it typed over", async () => {
    const user = setupUser();
    const onChange = show(row([{ id: "I", label: "+1 Initiative", at: 6, rolls: [4, 4, 2] }]));
    expect(screen.getByText("2D6 4 · 4")).toBeInTheDocument();
    expect(screen.getByLabelText("D6 rolled")).toHaveValue("2");
    await user.type(screen.getByLabelText("D6 rolled"), "5");
    expect(advancesOf(onChange)).toEqual([
      { id: "Ld", label: "+1 Leadership", at: 6, rolls: [4, 4, 5] },
    ]);
  });
});
