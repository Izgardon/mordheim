/**
 * Characterisation of the level-up control, dialog and request sequence for all three unit
 * kinds (pass 1 PR B, F2/F3: UnitLevelUpControl, UnitLevelUpDialog, useUnitLevelUp). Each kind
 * is reached through `kinds` below; re-point those adapters, not the assertions.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import HeroLevelUpControl from "./heroes/controls/HeroLevelUpControl";
import HenchmenLevelUpControl from "./henchmen/controls/HenchmenLevelUpControl";
import HiredSwordLevelUpControl from "./hiredswords/controls/HiredSwordLevelUpControl";
import { DiceContext } from "@/components/dice/dice-context";

import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHiredSword,
} from "@/features/warbands/types/warband-types";
import { getStatCheckbox, readStatsGrid, readStatsWithCheckbox } from "@/test/roster-queries";
import { setupUser } from "@/test/user-event";
import {
  makeVeteranHenchmenGroup,
  makeVeteranHero,
  makeVeteranHiredSword,
} from "@/test/warband-fixtures";

const api = vi.hoisted(() => ({
  levelUpWarbandHero: vi.fn(),
  levelUpWarbandHenchmenGroup: vi.fn(),
  levelUpWarbandHiredSword: vi.fn(),
  getWarbandHeroDetail: vi.fn(),
  getWarbandHenchmenGroupDetail: vi.fn(),
  getWarbandHiredSwordDetail: vi.fn(),
  createWarbandHero: vi.fn(),
  updateWarbandHenchmenGroup: vi.fn(),
  deleteWarbandHenchmenGroup: vi.fn(),
}));
const events = vi.hoisted(() => ({ emitWarbandUpdate: vi.fn() }));

vi.mock("@/features/warbands/api/warbands-api", () => api);
vi.mock("@/features/warbands/api/warbands-events", () => events);
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, diceColor: "#2e8555", campaignStarted: true }),
}));

/** Dice rolls served in order: each entry is the die values of one roll. */
const dice = { queue: [] as number[][] };
const diceContext = {
  roll: vi.fn(async () => dice.queue.shift() ?? []),
  preload: vi.fn(),
};

type Overrides = Record<string, unknown>;
type ControlProps = { onLevelUpLogged?: Mock; onGroupRemoved?: Mock };

type KindCase = {
  kind: string;
  control: (overrides?: Overrides, props?: ControlProps) => ReactElement;
  make: (overrides?: Overrides) => object;
  levelUpApi: Mock;
  detailApi: Mock;
  unitId: number;
  /** The payload key naming the unit, and its value. */
  nameKey: "hero" | "group";
  name: string;
  stats: string[];
  otherAdvances: string[];
};

const ALL_STATS = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"];

const trigger = <button type="button">Level Up!</button>;

const kinds: KindCase[] = [
  {
    kind: "hero",
    control: (overrides = {}, props = {}) => (
      <HeroLevelUpControl
        hero={makeVeteranHero(overrides as Partial<WarbandHero>)}
        warbandId={9}
        onLevelUpLogged={props.onLevelUpLogged}
        trigger={trigger}
      />
    ),
    make: (overrides = {}) => makeVeteranHero(overrides as Partial<WarbandHero>),
    levelUpApi: api.levelUpWarbandHero,
    detailApi: api.getWarbandHeroDetail,
    unitId: 11,
    nameKey: "hero",
    name: "Aldric the Bold",
    stats: ALL_STATS,
    otherAdvances: ["Skill", "Spell", "Special"],
  },
  {
    kind: "henchmen group",
    control: (overrides = {}, props = {}) => (
      <HenchmenLevelUpControl
        group={makeVeteranHenchmenGroup(overrides as Partial<HenchmenGroup>)}
        warbandId={9}
        onLevelUpLogged={props.onLevelUpLogged}
        onGroupRemoved={props.onGroupRemoved}
        trigger={trigger}
      />
    ),
    make: (overrides = {}) => makeVeteranHenchmenGroup(overrides as Partial<HenchmenGroup>),
    levelUpApi: api.levelUpWarbandHenchmenGroup,
    detailApi: api.getWarbandHenchmenGroupDetail,
    unitId: 21,
    nameKey: "group",
    name: "Black Knives",
    stats: ["WS", "BS", "S", "I", "A", "Ld"],
    otherAdvances: [],
  },
  {
    kind: "hired sword",
    control: (overrides = {}, props = {}) => (
      <HiredSwordLevelUpControl
        hiredSword={makeVeteranHiredSword(overrides as Partial<WarbandHiredSword>)}
        warbandId={9}
        onLevelUpLogged={props.onLevelUpLogged}
        trigger={trigger}
      />
    ),
    make: (overrides = {}) => makeVeteranHiredSword(overrides as Partial<WarbandHiredSword>),
    levelUpApi: api.levelUpWarbandHiredSword,
    detailApi: api.getWarbandHiredSwordDetail,
    unitId: 31,
    nameKey: "hero",
    name: "Brother Hal",
    stats: ALL_STATS,
    otherAdvances: ["Skill", "Spell", "Special"],
  },
];

const [heroKind, henchmenKind, hiredKind] = kinds;

const renderControl = (element: ReactElement) =>
  render(<DiceContext.Provider value={diceContext}>{element}</DiceContext.Provider>);

const openDialog = async (user: ReturnType<typeof setupUser>, element: ReactElement) => {
  renderControl(element);
  await user.click(screen.getByRole("button", { name: "Level Up!" }));
  return screen.findByRole("dialog", { name: "Level Up" });
};

const advanceTable = (dialog: HTMLElement) => within(dialog).getByRole("table");

const rollDice = async (
  user: ReturnType<typeof setupUser>,
  dialog: HTMLElement,
  button: "2d6" | "1d6",
  values: number[]
) => {
  dice.queue.push(values);
  await user.click(within(dialog).getByRole("button", { name: button }));
  await waitFor(() => expect(dice.queue).toHaveLength(0));
};

beforeEach(() => {
  vi.clearAllMocks();
  dice.queue = [];
});

describe.each(kinds)("$kind level-up control", (kind) => {
  it("shows its trigger only while the unit has a level-up to spend", () => {
    const { unmount } = renderControl(kind.control({ level_up: 2 }));
    expect(screen.getByRole("button", { name: "Level Up!" })).toBeInTheDocument();
    unmount();

    renderControl(kind.control({ level_up: 0 }));
    expect(screen.queryByRole("button", { name: "Level Up!" })).not.toBeInTheDocument();
  });

  it("opens the Level Up dialog from the trigger", async () => {
    const user = setupUser();

    const dialog = await openDialog(user, kind.control());

    expect(within(dialog).getByRole("button", { name: "Level up" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "2d6" })).toBeInTheDocument();
  });

  it("offers exactly the kind's advances", async () => {
    const user = setupUser();

    const dialog = await openDialog(user, kind.control());

    expect(readStatsWithCheckbox(advanceTable(dialog))).toEqual(kind.stats);
    for (const option of ["Skill", "Spell", "Special"]) {
      const checkbox = within(dialog).queryByRole("checkbox", { name: option });
      if (kind.otherAdvances.includes(option)) {
        expect(checkbox).toBeInTheDocument();
      } else {
        expect(checkbox).not.toBeInTheDocument();
      }
    }
  });

  it("shows each stat over its race maximum, with the picked advance applied", async () => {
    const user = setupUser();
    const dialog = await openDialog(user, kind.control());

    expect(readStatsGrid(advanceTable(dialog)).Ld).toMatch(/^\d+\/9$/);
    const before = readStatsGrid(advanceTable(dialog)).WS;
    await user.click(getStatCheckbox(advanceTable(dialog), "WS"));

    expect(getStatCheckbox(advanceTable(dialog), "WS")).toBeChecked();
    expect(readStatsGrid(advanceTable(dialog)).WS).toBe(`${Number(before.split("/")[0]) + 1}/6`);
  });

  it("POSTs one level-up with the picked stat and reports the updated unit", async () => {
    const user = setupUser();
    const onLevelUpLogged = vi.fn();
    kind.levelUpApi.mockResolvedValue({ id: kind.unitId, level_up: 0 });
    const dialog = await openDialog(user, kind.control({}, { onLevelUpLogged }));

    await user.click(getStatCheckbox(advanceTable(dialog), "WS"));
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    await waitFor(() => expect(onLevelUpLogged).toHaveBeenCalledTimes(1));
    expect(kind.levelUpApi).toHaveBeenCalledTimes(1);
    expect(kind.levelUpApi).toHaveBeenCalledWith(9, kind.unitId, {
      [kind.nameKey]: kind.name,
      advance: { id: "WS", label: "Weapon Skill" },
    });
    expect(onLevelUpLogged).toHaveBeenCalledWith({ id: kind.unitId, level_up: 0 });
    expect(api.createWarbandHero).not.toHaveBeenCalled();
    expect(kind.detailApi).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("applies a 2d6 roll of 7 as +1 WS and sends the roll", async () => {
    const user = setupUser();
    kind.levelUpApi.mockResolvedValue({ id: kind.unitId });
    const dialog = await openDialog(user, kind.control());

    await rollDice(user, dialog, "2d6", [3, 4]);
    await waitFor(() => expect(getStatCheckbox(advanceTable(dialog), "WS")).toBeChecked());
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    await waitFor(() =>
      expect(kind.levelUpApi).toHaveBeenCalledWith(9, kind.unitId, {
        [kind.nameKey]: kind.name,
        advance: { id: "WS", label: "Weapon Skill" },
        roll1: { dice: "2d6", result: { total: 7 } },
      })
    );
  });

  it("shows the server's error and stays open", async () => {
    const user = setupUser();
    kind.levelUpApi.mockRejectedValue(new Error("No level ups available"));
    const dialog = await openDialog(user, kind.control());

    await user.click(getStatCheckbox(advanceTable(dialog), "A"));
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    expect(await within(dialog).findByText("No level ups available")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Level Up" })).toBeInTheDocument();
  });

  it("fetches the unit once for its race profile when the summary has none", async () => {
    const user = setupUser();
    kind.detailApi.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(kind.make()), 5))
    );

    const dialog = await openDialog(user, kind.control({ race: undefined }));

    await waitFor(() => expect(readStatsGrid(advanceTable(dialog)).Ld).toMatch(/\/9$/));
    expect(kind.detailApi).toHaveBeenCalledTimes(1);
    expect(kind.detailApi).toHaveBeenCalledWith(9, kind.unitId);
  });

  it("refetches the unit in a loop while it has no race (pinned bug)", async () => {
    // Answer after a tick, like the network: an instant answer batches the loading flag away.
    kind.detailApi.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(kind.make({ race: null })), 5))
    );
    const { unmount } = renderControl(kind.control({ race_id: null, race: undefined }));

    // A plain click: act() would keep flushing the loop and never return.
    fireEvent.click(screen.getByRole("button", { name: "Level Up!" }));

    await waitFor(() => expect(kind.detailApi.mock.calls.length).toBeGreaterThan(3));
    unmount();
  });
});

describe.each(kinds)("$kind level-up dialog detail fetch", (kind) => {
  it("retries the failed unit fetch in a loop while the dialog is open (pinned bug)", async () => {
    kind.detailApi.mockImplementation(
      () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error("Gone")), 5))
    );
    const { unmount } = renderControl(kind.control({ race: undefined }));

    fireEvent.click(screen.getByRole("button", { name: "Level Up!" }));

    await waitFor(() => expect(kind.detailApi.mock.calls.length).toBeGreaterThan(3));
    unmount();
  });
});

describe.each([heroKind, hiredKind])("$kind advances", (kind) => {
  it("asks for a pick when Level up is pressed with none", async () => {
    const user = setupUser();
    const dialog = await openDialog(user, kind.control());

    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    expect(within(dialog).getByText("A Level up must be chosen.")).toBeInTheDocument();
    expect(kind.levelUpApi).not.toHaveBeenCalled();
  });

  it("resolves 2d6 = 6 with a 1d6 follow-up and sends both rolls", async () => {
    const user = setupUser();
    kind.levelUpApi.mockResolvedValue({ id: kind.unitId });
    const dialog = await openDialog(user, kind.control());

    expect(within(dialog).getByRole("button", { name: "1d6" })).toBeDisabled();
    await rollDice(user, dialog, "2d6", [2, 4]);
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "1d6" })).toBeEnabled());
    await rollDice(user, dialog, "1d6", [5]);
    await waitFor(() => expect(getStatCheckbox(advanceTable(dialog), "A")).toBeChecked());
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    await waitFor(() =>
      expect(kind.levelUpApi).toHaveBeenCalledWith(9, kind.unitId, {
        hero: kind.name,
        advance: { id: "A", label: "Attack" },
        roll1: { dice: "2d6", result: { total: 6 } },
        roll2: { dice: "1d6", result: { total: 5 } },
      })
    );
  });

  it("sends a Skill placeholder advance", async () => {
    const user = setupUser();
    kind.levelUpApi.mockResolvedValue({ id: kind.unitId });
    const dialog = await openDialog(user, kind.control());

    await user.click(within(dialog).getByRole("checkbox", { name: "Skill" }));
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    await waitFor(() =>
      expect(kind.levelUpApi).toHaveBeenCalledWith(9, kind.unitId, {
        hero: kind.name,
        advance: { id: "Skill", label: "Skill" },
      })
    );
  });

  it("offers Spell only to casters", async () => {
    const user = setupUser();

    const dialog = await openDialog(user, kind.control({ caster: "No" }));

    expect(within(dialog).queryByRole("checkbox", { name: "Spell" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: "Special" })).toBeInTheDocument();
  });

  it("falls back to the unit type, then a generic name, in the payload", async () => {
    const user = setupUser();
    kind.levelUpApi.mockResolvedValue({ id: kind.unitId });
    const dialog = await openDialog(user, kind.control({ name: " " }));

    await user.click(getStatCheckbox(advanceTable(dialog), "Ld"));
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    await waitFor(() => expect(kind.levelUpApi).toHaveBeenCalled());
    expect(kind.levelUpApi.mock.calls[0][2].hero).toBe(
      kind === heroKind ? "Captain" : "Warrior Priest"
    );
  });
});

describe("level-up control divergences", () => {
  it.each([henchmenKind, hiredKind])(
    "hides the $kind trigger when the unit takes no level-ups",
    (kind) => {
      renderControl(kind.control({ level_up: 1, no_level_ups: true }));

      expect(screen.queryByRole("button", { name: "Level Up!" })).not.toBeInTheDocument();
    }
  );

  it("keeps the hero trigger: heroes have no 'no level-ups' switch", () => {
    renderControl(heroKind.control({ level_up: 1, no_level_ups: true }));

    expect(screen.getByRole("button", { name: "Level Up!" })).toBeInTheDocument();
  });
});

describe("henchmen advances and Lad's Got Talent", () => {
  const group = makeVeteranHenchmenGroup();

  /** Records the promotion chain in order. */
  const recordPromotion = () => {
    const calls: string[] = [];
    api.createWarbandHero.mockImplementation(async (_w: number, body: { name: string }) => {
      calls.push("POST heroes/");
      return makeVeteranHero({ id: 15, name: body.name, is_leader: false });
    });
    api.levelUpWarbandHero.mockImplementation(async (_w: number, heroId: number) => {
      calls.push(`POST heroes/${heroId}/level-up/`);
      return {};
    });
    api.updateWarbandHenchmenGroup.mockImplementation(async (_w: number, groupId: number) => {
      calls.push(`PATCH henchmen-groups/${groupId}/`);
      return { ...group, henchmen: group.henchmen.slice(1) };
    });
    api.deleteWarbandHenchmenGroup.mockImplementation(async (_w: number, groupId: number) => {
      calls.push(`DELETE henchmen-groups/${groupId}/`);
    });
    events.emitWarbandUpdate.mockImplementation(() => calls.push("emit warband:updated"));
    return calls;
  };

  it("keeps Level up disabled until an advance is picked", async () => {
    const user = setupUser();
    const dialog = await openDialog(user, henchmenKind.control());

    expect(within(dialog).getByRole("button", { name: "Level up" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "1d6" })).not.toBeInTheDocument();
    await user.click(getStatCheckbox(advanceTable(dialog), "I"));

    expect(within(dialog).getByRole("button", { name: "Level up" })).toBeEnabled();
  });

  it("shows the 2d6 result instead of a second die", async () => {
    const user = setupUser();
    const dialog = await openDialog(user, henchmenKind.control());

    expect(within(dialog).getByText("Roll the dice to determine the advance.")).toBeInTheDocument();
    await rollDice(user, dialog, "2d6", [1, 1]);

    expect(await within(dialog).findByText("Result: 2")).toBeInTheDocument();
    expect(getStatCheckbox(advanceTable(dialog), "I")).toBeChecked();
  });

  it("names the group under `group` and sends the roll", async () => {
    const user = setupUser();
    api.levelUpWarbandHenchmenGroup.mockResolvedValue(group);
    const dialog = await openDialog(user, henchmenKind.control());

    await rollDice(user, dialog, "2d6", [4, 5]);
    await waitFor(() => expect(getStatCheckbox(advanceTable(dialog), "Ld")).toBeChecked());
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    await waitFor(() =>
      expect(api.levelUpWarbandHenchmenGroup).toHaveBeenCalledWith(9, 21, {
        group: "Black Knives",
        advance: { id: "Ld", label: "Leadership" },
        roll1: { dice: "2d6", result: { total: 9 } },
      })
    );
  });

  it("asks for a re-roll on 10-12 and blocks Level up until one is made", async () => {
    const user = setupUser();
    const dialog = await openDialog(user, henchmenKind.control());

    await rollDice(user, dialog, "2d6", [5, 6]);

    expect(
      await within(dialog).findByText(
        "Lads Got Talent rolled - roll again until you get a stat increase."
      )
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: "Lads got talent" })).toBeChecked();
    expect(within(dialog).getByRole("combobox")).toHaveTextContent("Blade One");
    expect(within(dialog).getByRole("button", { name: "Level up" })).toBeDisabled();
  });

  it("promotes a henchman through today's four-step chain, leaving the group's level-up unspent (BUG-28, pinned; flips in PR C)", async () => {
    const user = setupUser();
    const onLevelUpLogged = vi.fn();
    const calls = recordPromotion();
    const dialog = await openDialog(user, henchmenKind.control({}, { onLevelUpLogged }));

    await rollDice(user, dialog, "2d6", [6, 6]);
    await rollDice(user, dialog, "2d6", [4, 4]);
    await waitFor(() => expect(getStatCheckbox(advanceTable(dialog), "A")).toBeChecked());
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    await waitFor(() => expect(calls).toHaveLength(4));
    expect(calls).toEqual([
      "POST heroes/",
      "POST heroes/15/level-up/",
      "PATCH henchmen-groups/21/",
      "emit warband:updated",
    ]);
    expect(api.createWarbandHero).toHaveBeenCalledWith(
      9,
      {
        name: "Blade One",
        unit_type: "Thugs",
        race: 1,
        price: 0,
        xp: 4,
        level_up: 2,
        deeds: "Held the bridge for a whole turn.",
        armour_save: 6,
        large: false,
        caster: "No",
        half_rate: false,
        movement: 4,
        weapon_skill: 3,
        ballistic_skill: 3,
        strength: 3,
        toughness: 3,
        wounds: 1,
        initiative: 3,
        attacks: 1,
        leadership: 7,
        items: [
          { id: 104, cost: 3 },
          { id: 102, cost: 2 },
        ],
        skill_ids: [202],
        special_ids: [402],
        spell_ids: [],
        ignore_max_heroes: true,
      },
      { emitUpdate: false }
    );
    expect(api.levelUpWarbandHero).toHaveBeenCalledWith(9, 15, {
      hero: "Blade One",
      advance: { id: "A", label: "Attack" },
      roll1: { dice: "2d6", result: { total: 8 } },
    });
    expect(api.updateWarbandHenchmenGroup).toHaveBeenCalledWith(9, 21, {
      henchmen: [
        { id: 62, name: "Blade Two", kills: 0, dead: false, cost: undefined },
        { id: 63, name: "Blade Three", kills: 1, dead: false, cost: undefined },
      ],
      items: [
        { id: 104, cost: 3 },
        { id: 104, cost: 3 },
        { id: 102, cost: 2 },
        { id: 102, cost: 2 },
      ],
    });
    expect(events.emitWarbandUpdate).toHaveBeenCalledWith(9);
    expect(api.levelUpWarbandHenchmenGroup).not.toHaveBeenCalled();
    expect(onLevelUpLogged).toHaveBeenCalledTimes(1);
  });

  it("deletes the group when its last henchman is promoted", async () => {
    const user = setupUser();
    const onGroupRemoved = vi.fn();
    const onLevelUpLogged = vi.fn();
    const calls = recordPromotion();
    const dialog = await openDialog(
      user,
      henchmenKind.control(
        { henchmen: [group.henchmen[0]], items: [group.items[0]] },
        { onGroupRemoved, onLevelUpLogged }
      )
    );

    await user.click(within(dialog).getByRole("checkbox", { name: "Lads got talent" }));
    await user.click(getStatCheckbox(advanceTable(dialog), "WS"));
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    await waitFor(() => expect(onGroupRemoved).toHaveBeenCalledWith(21));
    expect(calls).toEqual([
      "POST heroes/",
      "POST heroes/15/level-up/",
      "DELETE henchmen-groups/21/",
      "emit warband:updated",
    ]);
    expect(api.deleteWarbandHenchmenGroup).toHaveBeenCalledWith(9, 21, { emitUpdate: false });
    // Ticked by hand without a roll: the hero's level-up carries no roll.
    expect(api.levelUpWarbandHero).toHaveBeenCalledWith(9, 15, {
      hero: "Blade One",
      advance: { id: "WS", label: "Weapon Skill" },
    });
    expect(onLevelUpLogged).not.toHaveBeenCalled();
  });

  it("leaves the new hero in place when a later step fails (BUG-28, pinned; flips in PR C)", async () => {
    const user = setupUser();
    const calls = recordPromotion();
    api.levelUpWarbandHero.mockRejectedValue(new Error("No level ups available"));
    const dialog = await openDialog(user, henchmenKind.control());

    await user.click(within(dialog).getByRole("checkbox", { name: "Lads got talent" }));
    await user.click(getStatCheckbox(advanceTable(dialog), "S"));
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    expect(await within(dialog).findByText("No level ups available")).toBeInTheDocument();
    expect(calls).toEqual(["POST heroes/"]);
    expect(api.updateWarbandHenchmenGroup).not.toHaveBeenCalled();
  });
});
