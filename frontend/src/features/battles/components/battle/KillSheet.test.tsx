/**
 * The kill sheet's victims (William, 25 Nov 2026): a henchmen group by its name, no "A " before
 * it, with its henchman type under it; a neutral group's tab its name alone; and each row the
 * warband page's mark for what it is.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import type { BattleNeutralGroup } from "@/features/battles/types/battle-types";
import {
  battleRosters,
  ME,
  myParticipant,
  OPPONENT,
  opponentParticipant,
} from "@/test/battle-fixtures";
import { setupUser } from "@/test/user-event";

import { battleSections, battleSides, victimOptions } from "./battle-units";
import KillSheet from "./KillSheet";

const VERMIN: BattleNeutralGroup = {
  key: "n1",
  name: "Vermin",
  creatures: [
    {
      key: "n1-1",
      name: "Giant Rat",
      creature_type: "Giant Rat",
      stats: {},
      max_wounds: 1,
      status: "standing",
      wounds: 1,
    },
    {
      key: "n1-2",
      name: "Rat Ogre",
      creature_type: "Rat Ogre",
      stats: {},
      max_wounds: 3,
      status: "knocked_down",
      wounds: 3,
    },
  ],
};

function show() {
  const rosters = toParticipantRosters(battleRosters());
  // the opponent logs a kill on the owner's warband, or on the neutral group
  const theirs = opponentParticipant();
  const sides = battleSides([myParticipant(), theirs], rosters, [VERMIN], OPPONENT.id).filter(
    (side) => !(side.kind === "warband" && side.mine)
  );
  const killer = battleSections(theirs, rosters[OPPONENT.id]).heroes[0];
  render(
    <KillSheet
      killer={{ name: killer.unit.displayName, models: [killer] }}
      round={2}
      sides={sides}
      rosters={rosters}
      onOpenChange={vi.fn()}
      onSave={vi.fn().mockResolvedValue(undefined)}
    />
  );
}

const rows = () =>
  within(screen.getByRole("radiogroup", { name: "Victim" }))
    .getAllByRole("radio")
    .map((row) => [
      row.querySelector("[data-marker]")?.getAttribute("data-marker"),
      row.textContent,
    ]);

describe("the kill sheet's victims", () => {
  it("names a henchmen group without an A, its type under it, each row with its mark", () => {
    show();

    expect(rows()).toEqual([
      ["hero", "Captain WolfCaptain · hero"],
      ["hero", "RolfChampion · hero"],
      ["henchmen", "YoungbloodsYoungblood · 1 of 1 standing"],
      ["hired", "Ogre BodyguardOgre · hired sword"],
    ]);
    expect(screen.queryByText(/^A /)).toBeNull();
  });

  it("gives a neutral group's tab its name alone, its creatures by their own type", async () => {
    const user = setupUser();
    show();

    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual([ME.warband.name, "Vermin"]);
    await user.click(screen.getByRole("tab", { name: "Vermin" }));
    expect(rows()).toEqual([
      ["animal", "Giant RatGiant Rat · standing"],
      ["animal", "Rat OgreRat Ogre · knocked down"],
    ]);
  });
});

describe("an animal group's mark", () => {
  it("is the paw, as on the warband page: from a creature, or with the Animal rule", () => {
    const raw = battleRosters();
    const group = raw[String(ME.id)].henchmenGroups[0];
    group.members[0] = { ...group.members[0], specials: [{ id: 3, name: "Animal" }] };
    const rosters = toParticipantRosters(raw);
    const side = battleSides([myParticipant()], rosters, [], OPPONENT.id)[0];

    expect(victimOptions(side, rosters).find((row) => row.name === "Youngbloods")?.marker).toBe(
      "animal"
    );
  });
});
