import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BattlePostbattleState } from "@/features/battles/types/battle-types";
import { rollDie } from "@/lib/dice";
import { setupUser } from "@/test/user-event";

import { advancesWaiting, rollAdvance, withFollowUp, type XpRow } from "./aftermath-xp";
import ExperienceTab from "./ExperienceTab";

vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: vi.fn(),
}));

const row = (advances: XpRow["advances"] = [], over: Partial<XpRow> = {}): XpRow => ({
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
  history: [],
  ...over,
});

const group = (advances: XpRow["advances"], history: string[] = []) =>
  row(advances, {
    name: "Marksmen",
    type: "Henchmen x3",
    group: true,
    thresholds: [2, 5, 9, 14],
    history,
  });

const TALENT = { id: "LGT", label: "The lad's got talent", at: 5, rolls: [5, 6] };

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

  it("read the table for the 2D6 given, never rolling a hero's follow-up D6", () => {
    // William, 18 Nov 2026: the second box opens blank, so the D6 is his to roll or type
    expect(rollAdvance(false, 6, [4, 4])).toEqual({
      id: "Pending",
      label: "Not rolled yet",
      at: 6,
      rolls: [4, 4],
    });
    expect(rollAdvance(false, 6, [3, 4])).toMatchObject({ id: "WS", rolls: [3, 4] });
    expect(rollAdvance(true, 6, [5, 6])).toMatchObject({ id: "LGT", rolls: [5, 6] });
    expect(rollDie).not.toHaveBeenCalled();
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

  it("counts an advance still waiting on its D6 as one to come", () => {
    const waiting = { id: "Pending", label: "Not rolled yet", at: 6, rolls: [4, 4] };
    expect(advancesWaiting(row([waiting]))).toBe(1);
    expect(advancesWaiting(row([withFollowUp(waiting, 5)]))).toBe(0);
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

  it("opens the follow-up D6's box empty and takes the face typed in", async () => {
    const user = setupUser();
    const onChange = show(row([{ id: "Pending", label: "Not rolled yet", at: 6, rolls: [4, 4] }]));
    expect(screen.getByText("2D6 4 · 4")).toBeInTheDocument();
    expect(screen.getByLabelText("D6 rolled")).toHaveValue("");
    await user.type(screen.getByLabelText("D6 rolled"), "2");
    expect(advancesOf(onChange)).toEqual([
      { id: "I", label: "+1 Initiative", at: 6, rolls: [4, 4, 2] },
    ]);
  });

  it("fills the follow-up D6's box when it is rolled instead", async () => {
    const user = setupUser();
    vi.mocked(rollDie).mockReturnValueOnce(6);
    const onChange = show(row([{ id: "Pending", label: "Not rolled yet", at: 6, rolls: [4, 4] }]));
    await user.click(screen.getByRole("button", { name: "Roll D6" }));
    expect(screen.getByLabelText("D6 rolled")).toHaveValue("6");
    expect(advancesOf(onChange)).toEqual([
      { id: "Ld", label: "+1 Leadership", at: 6, rolls: [4, 4, 6] },
    ]);
  });

  it("takes a 2D6 that needs a D6 and leaves the box blank", async () => {
    const user = setupUser();
    const onChange = show(row());
    await user.type(screen.getByLabelText("First D6 rolled"), "4");
    await user.keyboard("4");
    expect(advancesOf(onChange)).toEqual([
      { id: "Pending", label: "Not rolled yet", at: 6, rolls: [4, 4] },
    ]);
    expect(rollDie).not.toHaveBeenCalled();
  });
});

describe("a repeat advance", () => {
  // William, 12 Nov 2026: "greyed with a warning, and a prompt to re-roll". The warband page's
  // advance dialog bars a second lad's got talent before the roll; the Experience step rolls
  // first, so it greys the result it got and offers the 2D6 again.
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
  });

  it("greys the lad's got talent when the group has just had it, and prompts a roll again", () => {
    show(group([TALENT], ["I", "LGT"]));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The lad's got talent already came up on this advance: roll again."
    );
    expect(screen.getByText("The lad's got talent")).toHaveClass("text-muted-foreground");
    expect(screen.getByRole("button", { name: "Roll again" })).toBeInTheDocument();
  });

  it("bars it a second time inside one post-game, and takes the roll again typed in", async () => {
    const user = setupUser();
    const onChange = show(group([TALENT, { ...TALENT, at: 9 }]));

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    const boxes = screen.getAllByLabelText("First D6 rolled");
    await user.type(boxes[boxes.length - 1], "2");
    await user.keyboard("3");

    expect(advancesOf(onChange)).toEqual([
      TALENT,
      { id: "S", label: "+1 Strength", at: 9, rolls: [2, 3] },
    ]);
    expect(rollDie).not.toHaveBeenCalled();
  });

  it("leaves the first talent of a group that hasn't had one alone", () => {
    show(group([TALENT]));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Roll again" })).not.toBeInTheDocument();
    expect(screen.getByText("The lad's got talent")).toHaveClass("text-head");
  });
});
