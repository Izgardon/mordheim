/**
 * A closed card says when an advance left picks to choose (William, 28 Nov 2026: "when a unit has
 * a spell or skill or special to choose can we make it clear on their minimised card"), in the
 * open card's words; pressing it opens the card at the first pick.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithQueryClient } from "@/test/query-test-utils";
import { makeHero, makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

import type { WarbandHireling } from "../../types/warband-types";
import UnitCard from "./UnitCard";
import { pendingPicksText } from "./UnitPendingPicks";
import type { PendingList, RosterUnit } from "./unit-view";

const hero = (fields: Parameters<typeof makeHero>[0] = {}): RosterUnit => ({
  kind: "hero",
  unit: makeHero({ name: "Aldric Voss", ...fields }),
});
const hired = (fields: Partial<WarbandHireling>): RosterUnit => ({
  kind: "hireling",
  unit: { ...makeHero({ id: 3, name: "Grukk" }), ...fields } as WarbandHireling,
});

const renderCard = (
  entry: RosterUnit,
  { open = false, canEdit = true, onPendingPick = vi.fn<(list: PendingList) => void>() } = {}
) => {
  renderWithQueryClient(
    <UnitCard
      entry={entry}
      campaign={null}
      warbandId={9}
      open={open}
      canEdit={canEdit}
      onToggle={vi.fn()}
      onLoadout={vi.fn()}
      onEdit={vi.fn()}
      onRide={vi.fn()}
      onPendingPick={onPendingPick}
    />
  );
  return onPendingPick;
};

describe("The picks to choose on a closed card", () => {
  it.each([
    [{ pending_skills: 1 }, "Skill to choose"],
    [{ pending_spells: 1 }, "Spell to choose"],
    [{ pending_specials: 1 }, "Special to choose"],
    [{ pending_skills: 2 }, "2 skills to choose"],
    [{ pending_spells: 3 }, "3 spells to choose"],
    [{ pending_specials: 2 }, "2 specials to choose"],
    [{ pending_skills: 1, pending_spells: 1 }, "To choose: 1 skill, 1 spell"],
    [{ pending_skills: 2, pending_specials: 1 }, "To choose: 2 skills, 1 special"],
    [
      { pending_skills: 1, pending_spells: 2, pending_specials: 3 },
      "To choose: 1 skill, 2 spells, 3 specials",
    ],
  ])("words %o as %s", (fields, text) => {
    expect(pendingPicksText(hero(fields))).toBe(text);
  });

  it("calls a priest's spells prayers", () => {
    expect(pendingPicksText(hero({ pending_spells: 1 }), true)).toBe("Prayer to choose");
    expect(pendingPicksText(hero({ pending_spells: 2, pending_skills: 1 }), true)).toBe(
      "To choose: 1 skill, 2 prayers"
    );
  });

  it("says nothing at 0, nor for a henchmen group, which has no picks", () => {
    expect(
      pendingPicksText(hero({ pending_skills: 0, pending_spells: 0, pending_specials: 0 }))
    ).toBeNull();
    expect(pendingPicksText(hero())).toBeNull();
    expect(
      pendingPicksText({ kind: "henchmen_group", unit: makeVeteranHenchmenGroup() })
    ).toBeNull();
  });

  it.each([
    ["a hero", hero({ pending_skills: 1 })],
    ["a hired sword", hired({ pending_skills: 1 })],
    ["a dramatis persona", hired({ pending_skills: 1, kind: "dramatis_persona" })],
  ])("shows on %s's closed card, and opens it at the pick", async (_, entry) => {
    const onPendingPick = renderCard(entry);
    await userEvent.click(screen.getByRole("button", { name: "Skill to choose" }));
    expect(onPendingPick).toHaveBeenCalledWith("skills");
  });

  it("opens at the first list with a pick waiting", async () => {
    const onPendingPick = renderCard(hero({ pending_spells: 1, pending_specials: 1 }));
    await userEvent.click(screen.getByRole("button", { name: "To choose: 1 spell, 1 special" }));
    expect(onPendingPick).toHaveBeenCalledWith("spells");
  });

  it("is absent at 0 and on the open card, whose boxes show the picks", () => {
    renderCard(hero({ pending_skills: 0 }));
    expect(screen.queryByText(/to choose/i)).not.toBeInTheDocument();
    renderCard(hero({ pending_skills: 1 }), { open: true });
    expect(screen.queryByText("Skill to choose")).not.toBeInTheDocument();
  });

  it("only labels for a reader who can't edit the warband", () => {
    renderCard(hero({ pending_skills: 1 }), { canEdit: false });
    expect(screen.getByText("Skill to choose")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skill to choose" })).not.toBeInTheDocument();
  });
});
