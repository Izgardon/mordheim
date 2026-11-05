/**
 * The rolls your units make before the battle (William, 5 Nov 2026: "the user can decide"): a
 * line under each of your units whose special, skill or carried item's rule rolls, ticked or not,
 * a henchmen group's once, with Roll and the dice boxes. The faces stay while the page is open and
 * nothing is applied: the unit stays as it was until the player unticks him or edits his stats.
 */
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrebattleConfig } from "@/features/battles/hooks/usePrebattleConfig";
import { usePrebattleRolls } from "@/features/battles/hooks/usePrebattleRolls";
import { rollDie } from "@/lib/dice";
import { setupUser } from "@/test/user-event";

import type { ParticipantRoster, PrebattleUnit } from "./prebattle-types";
import PrebattleUnits from "./PrebattleUnits";

vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: vi.fn(),
}));

const WOUND = "On a 1 on a D6 at the start of any battle he can't fight.";
const wound = { id: 4, name: "Old Battle Wound", prebattleRoll: "D6", prebattleText: WOUND };
const mask = {
  id: 8,
  name: "Jester Mask",
  count: 1,
  singleUse: false,
  prebattleRolls: [{ rule: "Grin", roll: "2D6", text: "On a 2, stupid." }],
};
const STATS = {
  movement: 4,
  weapon_skill: 3,
  ballistic_skill: 3,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 3,
  attacks: 1,
  leadership: 7,
  armour_save: null,
};
const unit = (key: string, displayName: string, fields: Partial<PrebattleUnit> = {}) =>
  ({
    key,
    id: Number(key.split(":")[1]),
    kind: key.split(":")[0],
    displayName,
    unitType: "Warrior",
    stats: STATS,
    ...fields,
  }) as PrebattleUnit;

const roster: ParticipantRoster = {
  heroes: [
    unit("hero:1", "Gunther", { specials: [{ id: 3, name: "Hardened" }, wound] }),
    unit("hero:2", "Otto", { skills: [{ id: 5, name: "Strike to Injure" }] }),
  ],
  hirelings: [],
  henchmenGroups: [
    {
      id: 2,
      name: "Lads",
      unitType: "Warrior",
      members: [
        unit("henchman:6", "Lad 1", { specials: [wound], items: [mask] }),
        unit("henchman:7", "Lad 2", { specials: [wound], items: [mask] }),
      ],
    },
  ],
};
const config = {
  editingUnitKey: null,
  toggleUnitSelection: vi.fn(),
  toggleEditingUnit: vi.fn(),
} as unknown as PrebattleConfig;

/** The page: your units with their rolls, and another warband's in their place on demand. */
function Page() {
  const rolls = usePrebattleRolls();
  const [theirs, setTheirs] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setTheirs((shown) => !shown)}>
        Switch
      </button>
      <PrebattleUnits
        roster={theirs ? { ...roster, heroes: [], henchmenGroups: [] } : roster}
        customUnits={[]}
        selectedKeys={["hero:2"]}
        overrides={{}}
        config={theirs ? undefined : config}
        rolls={theirs ? undefined : rolls}
      />
    </>
  );
}

const line = (name: string) => screen.getByRole("group", { name: `${name} roll` });

describe("Your units' rolls before the battle", () => {
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
  });

  it("show under a unit whose rule rolls, ticked or not, and once for a group", () => {
    render(<Page />);
    expect(screen.getByRole("checkbox", { name: "Bring Gunther" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getAllByRole("group", { name: "Old Battle Wound roll" })).toHaveLength(2);
    expect(screen.getAllByText(WOUND)).toHaveLength(2);
    expect(screen.getAllByRole("group", { name: "Grin (Jester Mask) roll" })).toHaveLength(1);
    expect(screen.getByText("On a 2, stupid.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Hardened roll" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Strike to Injure roll" })).not.toBeInTheDocument();
  });

  it("roll or take the faces typed, keep them while the page is open and change nothing", async () => {
    const user = setupUser();
    vi.mocked(rollDie).mockReturnValueOnce(3).mockReturnValueOnce(5);
    render(<Page />);
    const hero = screen.getAllByRole("group", { name: "Old Battle Wound roll" })[0];
    await user.type(within(hero).getByLabelText("D6 rolled"), "1");
    expect(within(hero).getByLabelText("D6 rolled")).toHaveValue("1");
    await user.click(within(line("Grin (Jester Mask)")).getByRole("button", { name: "Roll 2D6" }));
    expect(within(line("Grin (Jester Mask)")).getByText("= 8")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Switch" }));
    expect(screen.queryByRole("group", { name: "Old Battle Wound roll" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Switch" }));

    const again = screen.getAllByRole("group", { name: "Old Battle Wound roll" })[0];
    expect(within(again).getByLabelText("D6 rolled")).toHaveValue("1");
    expect(within(again).getByRole("button", { name: "Roll again" })).toBeInTheDocument();
    expect(within(line("Grin (Jester Mask)")).getByText("= 8")).toBeInTheDocument();
    expect(config.toggleUnitSelection).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "Bring Gunther" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });
});
