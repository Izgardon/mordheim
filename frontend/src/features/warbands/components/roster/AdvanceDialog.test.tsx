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
import { makeHero } from "@/test/warband-fixtures";

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
    await user.type(screen.getByLabelText("2D6 rolled"), "7");
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
    await user.click(within(advanceTable()).getByRole("button", { name: /Weapon Skill or/ }));
    expect(screen.getByLabelText("2D6 rolled")).toHaveValue(7);
    await user.click(within(advanceTable()).getAllByRole("button", { name: "New skill" })[0]);
    expect(screen.getByLabelText("2D6 rolled")).toHaveValue(null);
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
    await user.type(screen.getByLabelText("2D6 rolled"), "6");
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
    await user.type(screen.getByLabelText("2D6 rolled"), "3");
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

  it("adds 1 to its number and warns that its written value needs updating", async () => {
    openFor({ ...hero, attacks: 1, written_stats: { attacks: "1(2)" } });
    const user = setupUser();
    await user.type(screen.getByLabelText("2D6 rolled"), "6");
    await user.type(screen.getByLabelText("D6 rolled"), "5");
    expect(screen.getByText(/^A 1 → 2/)).toBeInTheDocument();
    expect(
      screen.getByText("Written 1(2): the 1 goes on its number, so update it in Edit")
    ).toBeInTheDocument();
  });

  it("warns that a written stat with no number gets nothing", async () => {
    openFor({ ...hero, weapon_skill: null, written_stats: { weapon_skill: "D6" } });
    const user = setupUser();
    await user.type(screen.getByLabelText("2D6 rolled"), "7");
    await user.selectOptions(screen.getByRole("combobox", { name: "Characteristic" }), "WS");
    expect(screen.getByText(/WS D6/)).toBeInTheDocument();
    expect(
      screen.getByText("Written D6, with no number to add 1 to: update it in Edit")
    ).toBeInTheDocument();
  });
});
