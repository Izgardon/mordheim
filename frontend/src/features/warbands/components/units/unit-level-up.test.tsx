/**
 * Characterisation of the level-up control, dialog and request sequence for all three unit
 * kinds (pass 1 PR B, F2/F3: UnitLevelUpControl, UnitLevelUpDialog, useUnitLevelUp). Each kind
 * is reached through `kinds` below; re-point those adapters, not the assertions.
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import UnitLevelUpControl from "./UnitLevelUpControl";
import { DiceContext } from "@/components/dice/dice-context";
import { heroKind as heroConfig } from "@/features/warbands/units/kinds/hero";
import { henchmenKind as henchmenConfig } from "@/features/warbands/units/kinds/henchmen";
import { hiredSwordKind as hiredSwordConfig } from "@/features/warbands/units/kinds/hired-sword";

import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHiredSword,
} from "@/features/warbands/types/warband-types";
import { ApiError } from "@/lib/api-client";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
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
  promoteWarbandHenchman: vi.fn(),
}));
const events = vi.hoisted(() => ({ emitWarbandUpdate: vi.fn() }));

vi.mock("@/features/warbands/api/warbands-api", () => api);
vi.mock("@/features/warbands/units/unit-api", async () =>
  (await import("@/test/unit-api-mock")).unitApiModuleMock(api)
);
vi.mock("@/features/warbands/api/warband-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/warbands/api/warband-cache")>()),
  useWarbandCacheUpdate: () => events.emitWarbandUpdate,
}));
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
      <UnitLevelUpControl
        kind={heroConfig}
        unit={makeVeteranHero(overrides as Partial<WarbandHero>)}
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
      <UnitLevelUpControl
        kind={henchmenConfig}
        unit={makeVeteranHenchmenGroup(overrides as Partial<HenchmenGroup>)}
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
      <UnitLevelUpControl
        kind={hiredSwordConfig}
        unit={makeVeteranHiredSword(overrides as Partial<WarbandHiredSword>)}
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

const renderControl = (element: ReactElement, queryClient = createTestQueryClient()) =>
  renderWithQueryClient(
    <DiceContext.Provider value={diceContext}>{element}</DiceContext.Provider>,
    {
      queryClient,
    }
  );

const openDialog = async (
  user: ReturnType<typeof setupUser>,
  element: ReactElement,
  queryClient = createTestQueryClient()
) => {
  renderControl(element, queryClient);
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

  it("names each advance checkbox after its characteristic (UX-04)", async () => {
    const user = setupUser();
    const dialog = await openDialog(user, kind.control({ weapon_skill: 4 }));

    await user.click(within(dialog).getByRole("checkbox", { name: "Weapon Skill" }));

    expect(getStatCheckbox(advanceTable(dialog), "WS")).toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Advance roll table" })).toBeInTheDocument();
  });

  it("marks a stat already at its race maximum as max (UX-04)", async () => {
    const user = setupUser();
    const dialog = await openDialog(user, kind.control({ weapon_skill: 6, leadership: 7 }));

    const atMax = within(dialog).getByRole("checkbox", {
      name: "Weapon Skill (at the race maximum)",
    });
    expect(atMax.closest("td")).toHaveTextContent("max");
    expect(getStatCheckbox(advanceTable(dialog), "Ld")).toHaveAccessibleName("Leadership");
    expect(getStatCheckbox(advanceTable(dialog), "Ld").closest("td")).not.toHaveTextContent("max");
  });

  it("warns, without blocking, when the pick passes the race maximum (decision 10, BUG-32)", async () => {
    const user = setupUser();
    kind.levelUpApi.mockResolvedValue({ id: kind.unitId, level_up: 0 });
    const dialog = await openDialog(user, kind.control({ weapon_skill: 6 }));

    expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
    await user.click(getStatCheckbox(advanceTable(dialog), "WS"));

    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "WS 7 is above the Human maximum of 6. You can still take this advance."
    );
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));
    await waitFor(() =>
      expect(kind.levelUpApi).toHaveBeenCalledWith(
        9,
        kind.unitId,
        expect.objectContaining({ advance: { id: "WS", label: "Weapon Skill" } })
      )
    );
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
    expect(api.promoteWarbandHenchman).not.toHaveBeenCalled();
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

  it("shows the unit's own race profile without fetching the unit (PERF-26)", async () => {
    const user = setupUser();

    const dialog = await openDialog(user, kind.control());

    expect(readStatsGrid(advanceTable(dialog)).Ld).toMatch(/\/9$/);
    expect(kind.detailApi).not.toHaveBeenCalled();
  });

  it("fetches nothing while open for a unit without a race (BUG-98)", async () => {
    // The old dialog refetched the unit about once per round trip while it had no race.
    kind.detailApi.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(kind.make({ race: null })), 5))
    );
    const { unmount } = renderControl(kind.control({ race_id: null, race: null }));

    fireEvent.click(screen.getByRole("button", { name: "Level Up!" }));
    await screen.findByRole("dialog", { name: "Level Up" });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(kind.detailApi).not.toHaveBeenCalled();
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

  const promotedHero = makeVeteranHero({ id: 15, name: "Blade One", is_leader: false });
  const summary = { gold: 140, rating: 85 };
  const capRefusal = new ApiError("Warband already has 6 heroes", 400, {
    detail: "Warband already has 6 heroes",
    code: "hero_cap_reached",
    fields: {},
  });

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

  it("promotes a henchman in one promote/ request and writes its answer to the sheet (decision 9, BUG-28)", async () => {
    const user = setupUser();
    const onLevelUpLogged = vi.fn();
    const remaining = { ...group, henchmen: group.henchmen.slice(1), level_up: 0 };
    api.promoteWarbandHenchman.mockResolvedValue({ hero: promotedHero, group: remaining, summary });
    const dialog = await openDialog(user, henchmenKind.control({}, { onLevelUpLogged }));

    await rollDice(user, dialog, "2d6", [6, 6]);
    await rollDice(user, dialog, "2d6", [4, 4]);
    await waitFor(() => expect(getStatCheckbox(advanceTable(dialog), "A")).toBeChecked());
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    await waitFor(() => expect(api.promoteWarbandHenchman).toHaveBeenCalledTimes(1));
    expect(api.promoteWarbandHenchman).toHaveBeenCalledWith(9, 21, {
      henchman_id: 61,
      advance: { id: "A", label: "Attack" },
      roll1: { dice: "2d6", result: { total: 8 } },
    });
    // One request: no hero create, no level-ups and no group write from the client.
    expect(api.levelUpWarbandHero).not.toHaveBeenCalled();
    expect(api.levelUpWarbandHenchmenGroup).not.toHaveBeenCalled();
    expect(events.emitWarbandUpdate).toHaveBeenCalledTimes(1);
    expect(events.emitWarbandUpdate).toHaveBeenCalledWith(9, {
      heroes: [promotedHero],
      removedHeroIds: undefined,
      henchmenGroups: [remaining],
      removedHenchmenGroupIds: undefined,
      summary,
    });
    expect(onLevelUpLogged).toHaveBeenCalledWith(remaining);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("drops the group from the sheet when its last henchman is promoted", async () => {
    const user = setupUser();
    const onGroupRemoved = vi.fn();
    const onLevelUpLogged = vi.fn();
    api.promoteWarbandHenchman.mockResolvedValue({ hero: promotedHero, group: null, summary });
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
    // Ticked by hand without a roll: the advance carries no roll.
    expect(api.promoteWarbandHenchman).toHaveBeenCalledWith(9, 21, {
      henchman_id: 61,
      advance: { id: "WS", label: "Weapon Skill" },
    });
    expect(events.emitWarbandUpdate).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ removedHenchmenGroupIds: [21], henchmenGroups: undefined })
    );
    expect(onLevelUpLogged).not.toHaveBeenCalled();
  });

  it("writes nothing when the promotion is refused: the server applies all or nothing (BUG-28)", async () => {
    const user = setupUser();
    api.promoteWarbandHenchman.mockRejectedValue(
      new ApiError("No level ups available", 400, {
        detail: "No level ups available",
        code: "no_level_ups",
        fields: {},
      })
    );
    const dialog = await openDialog(user, henchmenKind.control());

    await user.click(within(dialog).getByRole("checkbox", { name: "Lads got talent" }));
    await user.click(getStatCheckbox(advanceTable(dialog), "S"));
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    expect(await within(dialog).findByText("No level ups available")).toBeInTheDocument();
    expect(api.promoteWarbandHenchman).toHaveBeenCalledTimes(1);
    expect(events.emitWarbandUpdate).not.toHaveBeenCalled();
    expect(within(dialog).queryByLabelText("Hero to dismiss")).not.toBeInTheDocument();
  });

  it("at the hero cap, offers a hero to dismiss and resends with dismiss_hero_id (ROST-TWEAK-04)", async () => {
    const user = setupUser();
    const queryClient = createTestQueryClient();
    const otto = makeVeteranHero({ id: 12, name: "Champion Otto", is_leader: false });
    const fallen = makeVeteranHero({ id: 13, name: "Fallen Hans", dead: true });
    queryClient.setQueryData(["campaign", 1, "warband", 9, "sheet"], {
      heroes: [makeVeteranHero(), otto, fallen],
    });
    api.promoteWarbandHenchman
      .mockRejectedValueOnce(capRefusal)
      .mockResolvedValueOnce({ hero: promotedHero, group, summary });
    const dialog = await openDialog(user, henchmenKind.control(), queryClient);

    await user.click(within(dialog).getByRole("checkbox", { name: "Lads got talent" }));
    await user.click(getStatCheckbox(advanceTable(dialog), "I"));
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    expect(
      await within(dialog).findByText(
        "Warband already has 6 heroes. Pick a hero to dismiss to make room."
      )
    ).toBeInTheDocument();
    // Without a pick, Level up asks for one instead of sending the same refusal again.
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));
    expect(within(dialog).getByText("Pick a hero to dismiss to make room.")).toBeInTheDocument();
    expect(api.promoteWarbandHenchman).toHaveBeenCalledTimes(1);

    // Radix Select: open it from the keyboard; the dead hero isn't offered.
    within(dialog).getByRole("combobox", { name: "Hero to dismiss" }).focus();
    await user.keyboard("{Enter}");
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "Aldric the Bold",
      "Champion Otto",
    ]);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(dialog).toHaveTextContent(
      "Are you sure you want to dismiss Champion Otto? The unit is removed now, and no gold is refunded."
    );
    expect(dialog).toHaveTextContent(
      "All items this unit carries are lost. Move them to the stash first to keep them."
    );
    await user.click(within(dialog).getByRole("button", { name: "Level up" }));

    await waitFor(() => expect(api.promoteWarbandHenchman).toHaveBeenCalledTimes(2));
    expect(api.promoteWarbandHenchman).toHaveBeenLastCalledWith(9, 21, {
      henchman_id: 61,
      advance: { id: "I", label: "Initiative" },
      dismiss_hero_id: 12,
    });
    expect(events.emitWarbandUpdate).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ heroes: [promotedHero], removedHeroIds: [12], summary })
    );
  });
});
