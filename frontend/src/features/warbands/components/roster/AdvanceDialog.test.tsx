/**
 * The advance guides the player (William: "no information about what will be received or why, and
 * it doesnt allow things to be chosen within that modal which is the entire point"), and has no "by
 * hand" mode ("just let the table always be clickable"): a row clicked is taken as if the dice had
 * shown it, a row with two outcomes picks one from a dropdown that its D6 presets, a new skill row
 * gives a skill, a spell or a boon or bane, and the Gains line alone says what he gets.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeHenchmenGroup, makeHero } from "@/test/warband-fixtures";

import AdvanceDialog from "./AdvanceDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("../../api/warband-cache", () => ({ useWarbandCacheUpdate: () => () => undefined }));

const LEVEL_UP = "POST /warbands/9/heroes/5/level-up/";
const hero = makeHero({
  id: 5,
  name: "Aldric Voss",
  level_up: 1,
  weapon_skill: 3,
  race_id: 2,
  available_skills: ["Combat"],
});

const open = () =>
  renderWithQueryClient(
    <AdvanceDialog
      entry={{ kind: "hero", unit: hero }}
      campaignId={1}
      warbandId={9}
      heroes={[hero]}
      maxHeroes={6}
      onClose={vi.fn()}
    />
  );

const advanceTable = () => screen.getByRole("table", { name: "Hero advance table" });
/** The 2D6 typed in, a box each: "34" is a 3 and a 4. */
const roll2D6 = async (user: ReturnType<typeof setupUser>, typed: string) => {
  await user.type(screen.getByLabelText("First D6 rolled"), typed[0]);
  await user.keyboard(typed[1]);
};
const faces = () =>
  ["First D6 rolled", "Second D6 rolled"].map(
    (name) => (screen.getByLabelText(name) as HTMLInputElement).value
  );

describe("The advance dialog", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on(LEVEL_UP, hero);
    fakeApi.on("GET /races/?campaign_id=1", [{ id: 2, name: "Human", weapon_skill: 3 }]);
    fakeApi.on("GET /skills/?campaign_id=1", [
      { id: 3, name: "Strike to Injure", type: "Combat", description: "Wounds harder." },
      { id: 4, name: "Sprint", type: "Speed", description: "Runs further." },
    ]);
  });

  it("has no by-hand mode; a 7 asks WS or BS in a dropdown and the Gains line alone shows it", async () => {
    open();
    const user = setupUser();
    expect(screen.queryByRole("button", { name: "By hand" })).not.toBeInTheDocument();
    await roll2D6(user, "34");
    expect(within(advanceTable()).getByRole("row", { current: true })).toHaveTextContent(
      "+1 Weapon Skill or +1 Ballistic Skill"
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Characteristic" }), "WS");
    expect(screen.getAllByText(/WS 3 → 4/)).toHaveLength(1);
    expect(await screen.findByText("Above his race maximum")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(fakeApi.bodyOf(LEVEL_UP)).toEqual({
      payload: {
        hero: "Aldric Voss",
        advance: { id: "WS", label: "Weapon Skill" },
        roll1: { dice: "2d6", result: { total: 7 } },
      },
    });
  });

  it("takes a clicked row as if the dice had shown it, a range row with no roll", async () => {
    open();
    const user = setupUser();
    await roll2D6(user, "34");
    await user.click(within(advanceTable()).getByRole("button", { name: /Weapon Skill or/ }));
    expect(within(advanceTable()).getByRole("row", { current: true })).toHaveTextContent("7");
    expect(faces()).toEqual(["3", "4"]);
    await user.click(within(advanceTable()).getAllByRole("button", { name: "New skill" })[0]);
    expect(faces()).toEqual(["", ""]);
    expect(within(advanceTable()).getByRole("row", { current: true })).toHaveTextContent("2–5");
    await user.click(await screen.findByRole("option", { name: /Strike to Injure/ }));
    expect(screen.getByText("New skill: Strike to Injure")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(fakeApi.bodyOf(LEVEL_UP)).toEqual({
      payload: { hero: "Aldric Voss", advance: { id: "Skill", label: "Skill" } },
      pick: { list: "skills", id: 3 },
    });
  });

  it("presets a D6 row's stat from the die, which can still be changed", async () => {
    open();
    const user = setupUser();
    await roll2D6(user, "33");
    const stat = screen.getByRole("combobox", { name: "Characteristic" });
    await user.type(screen.getByLabelText("D6 rolled"), "5");
    expect(stat).toHaveValue("A");
    await user.selectOptions(stat, "S");
    expect(screen.getByText(/^S \d+ → \d+/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(fakeApi.bodyOf(LEVEL_UP)).toMatchObject({
      payload: {
        advance: { id: "S" },
        roll1: { dice: "2d6", result: { total: 6 } },
        roll2: { dice: "1d6", result: { total: 5 } },
      },
    });
  });

  it("offers a skill, a spell or a general boon or bane for a new skill, each with its picker", async () => {
    fakeApi.on("GET /special/?campaign_id=1", [
      { id: 80, name: "Hatred", type: "Psychology", kind: "boon", description: "Hates." },
      { id: 82, name: "Spy", type: "Hired Sword - Freelance Knight", owner_kind: "hired_sword" },
    ]);
    open();
    const user = setupUser();
    await roll2D6(user, "12");
    const kind = screen.getByRole("combobox", { name: "New" });
    expect(kind).toHaveValue("Skill");
    expect(await screen.findByRole("option", { name: /Strike to Injure/ })).toBeInTheDocument();

    await user.selectOptions(kind, "Spell");
    expect(screen.getByText("Not a Wizard or Priest")).toBeInTheDocument();

    await user.selectOptions(kind, "Special");
    await screen.findByRole("option", { name: /Hatred/ });
    expect(screen.queryByRole("option", { name: /Spy/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /Hatred/ }));
    expect(screen.getByText("New boon: Hatred")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(fakeApi.bodyOf(LEVEL_UP)).toMatchObject({
      payload: { advance: { id: "Special" } },
      pick: { list: "specials", id: 80 },
    });
  });
});

describe("An advance on a written stat", () => {
  const openFor = (unit: ReturnType<typeof makeHero>) =>
    renderWithQueryClient(
      <AdvanceDialog
        entry={{ kind: "hero", unit }}
        campaignId={1}
        warbandId={9}
        heroes={[unit]}
        maxHeroes={6}
        onClose={vi.fn()}
      />
    );

  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /races/?campaign_id=1", []);
    fakeApi.on("GET /skills/?campaign_id=1", []);
  });

  it("shows the whole written value before and after, and that only its first number goes up", async () => {
    openFor({ ...hero, attacks: 1, written_stats: { attacks: "(2)" } });
    const user = setupUser();
    await roll2D6(user, "33");
    await user.type(screen.getByLabelText("D6 rolled"), "5");
    expect(screen.getByText(/^A 1\(2\) → 2\(2\)/)).toBeInTheDocument();
    expect(screen.getByText("Only the first number goes up")).toBeInTheDocument();
  });

  it("warns that a written stat with no number gets nothing", async () => {
    openFor({ ...hero, weapon_skill: null, written_stats: { weapon_skill: "D6" } });
    const user = setupUser();
    await roll2D6(user, "34");
    await user.selectOptions(screen.getByRole("combobox", { name: "Characteristic" }), "WS");
    expect(screen.getByText(/WS D6/)).toBeInTheDocument();
    expect(screen.getByText("D6 has no number to add 1 to")).toBeInTheDocument();
  });
});

describe("The lad's got talent", () => {
  const PROMOTE = "POST /warbands/9/henchmen-groups/7/promote/";
  const GROUP_LEVEL_UP = "POST /warbands/9/henchmen-groups/7/level-up/";
  const group = makeHenchmenGroup({
    id: 7,
    name: "Zealots",
    level_up: 1,
    initiative: 3,
    henchmen: [
      { id: 71, name: "Alpha", kills: 0, dead: false },
      { id: 72, name: "Beta", kills: 0, dead: false },
    ],
  } as never);
  const openGroup = (unit = group) =>
    renderWithQueryClient(
      <AdvanceDialog
        entry={{ kind: "henchmen_group", unit }}
        campaignId={1}
        warbandId={9}
        heroes={[]}
        maxHeroes={6}
        onClose={vi.fn()}
      />
    );

  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /races/?campaign_id=1", []);
  });

  it("promotes the henchman picked, then rolls the rest of the group again without the talent", async () => {
    const user = setupUser();
    fakeApi.on(PROMOTE, {
      hero: makeHero({ id: 90, name: "Beta", level_up: 1 }),
      group: { ...group, henchmen: [group.henchmen[0]] },
      summary: {},
    });
    fakeApi.on(GROUP_LEVEL_UP, group);
    openGroup();

    await roll2D6(user, "56");
    const promote = screen.getByRole("button", { name: "Pick who joins the heroes" });
    expect(promote).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Beta" }));
    await user.click(screen.getByRole("button", { name: "Promote Beta" }));

    expect(fakeApi.bodyOf(PROMOTE)).toEqual({ henchman_id: 72 });
    expect(await screen.findByText(/already came up, roll again/)).toBeInTheDocument();
    expect(faces()).toEqual(["", ""]);
    await roll2D6(user, "66");
    expect(screen.getByRole("alert")).toHaveTextContent("roll again");
    expect(screen.queryByRole("button", { name: /Promote/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    await roll2D6(user, "12");
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(fakeApi.bodyOf(GROUP_LEVEL_UP)).toMatchObject({ payload: { advance: { id: "I" } } });
  });

  it("keeps the talent out of a level-up it already came up on", async () => {
    const user = setupUser();
    const history = [{ code: "LGT", label: "Lad's Got Talent", timestamp: "2026-11-03T10:00:00Z" }];
    openGroup({ ...group, level_up_history: history });

    await roll2D6(user, "55");

    expect(screen.getByRole("alert")).toHaveTextContent("already came up on this advance");
    expect(screen.queryByRole("button", { name: "Pick who joins the heroes" })).toBeNull();
  });
});
