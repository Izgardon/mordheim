/**
 * Add a neutral group: the creature type is the app's searchable select, as the race field and
 * the warband type picker are (William, 12 Nov 2026: the creature-type dropdown should read as a
 * picker), and a type the bestiary doesn't hold is used as typed.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { catalogueListKey } from "@/lib/catalogue-queries";
import { bestiaryEntry } from "@/test/catalogue-fixtures";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import { AddNeutralGroupSheet } from "./UnitSheets";

const CAMPAIGN = 1;

function show() {
  const onAdd = vi.fn().mockResolvedValue(undefined);
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(catalogueListKey(CAMPAIGN, "bestiary"), [bestiaryEntry()]);
  renderWithQueryClient(
    <AddNeutralGroupSheet open onOpenChange={vi.fn()} campaignId={CAMPAIGN} onAdd={onAdd} />,
    { queryClient }
  );
  return { onAdd, field: screen.getByRole("combobox", { name: "Creature type" }) };
}

describe("the neutral group's creature type", () => {
  it("picks a creature from the bestiary, profile and all", async () => {
    const user = setupUser();
    const { onAdd, field } = show();

    await user.type(field, "hound");
    await user.click(screen.getByRole("option", { name: /Warhound/ }));
    await user.click(screen.getByRole("button", { name: "Add the group" }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        creatureType: "Warhound",
        name: "Warhounds",
        stats: expect.objectContaining({ weapon_skill: 4, toughness: 3 }),
      })
    );
  });

  it("uses a type the bestiary doesn't hold, as typed", async () => {
    const user = setupUser();
    const { onAdd, field } = show();

    await user.type(field, "Giant Spider");
    await user.click(screen.getByRole("option", { name: /Use “Giant Spider” as the type/ }));
    await user.click(screen.getByRole("button", { name: "Add the group" }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ creatureType: "Giant Spider", stats: undefined })
    );
  });
});
