/**
 * Add a unit, this battle only (William, 25 Nov 2026): a creature group takes a creature from the
 * bestiary (profile and all) or a typed type, in whatever amount, so it can hold several kinds;
 * your warband takes a bestiary creature, which fills the temporary unit's form, or the form
 * typed in whole. The creature is picked on the app's searchable select (William, 12 Nov 2026).
 */
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCustomUnitDraft } from "@/features/battles/hooks/useCustomUnitDraft";
import type { BattleNeutralGroup } from "@/features/battles/types/battle-types";
import { catalogueListKey } from "@/lib/catalogue-queries";
import { bestiaryEntry } from "@/test/catalogue-fixtures";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import AddUnitSheet from "./AddUnitSheet";

const CAMPAIGN = 1;
const VERMIN: BattleNeutralGroup = { key: "n1", name: "Vermin", creatures: [] };

function Sheet(props: {
  initialGroup?: string;
  onAddCreatures: () => Promise<void>;
  onAddToWarband: () => Promise<boolean>;
}) {
  const draft = useCustomUnitDraft();
  return (
    <AddUnitSheet
      open
      onOpenChange={vi.fn()}
      campaignId={CAMPAIGN}
      draft={draft}
      groups={[VERMIN]}
      canAddToWarband
      {...props}
    />
  );
}

function show(initialGroup?: string) {
  const onAddCreatures = vi.fn().mockResolvedValue(undefined);
  const onAddToWarband = vi.fn().mockResolvedValue(true);
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(catalogueListKey(CAMPAIGN, "bestiary"), [
    bestiaryEntry({ wounds: 2, rating: 9 }),
  ]);
  renderWithQueryClient(
    <Sheet
      initialGroup={initialGroup}
      onAddCreatures={onAddCreatures}
      onAddToWarband={onAddToWarband}
    />,
    { queryClient }
  );
  return { onAddCreatures, onAddToWarband };
}

describe("Add a unit to a creature group", () => {
  it("adds a bestiary creature, profile and all, in whatever amount", async () => {
    const user = setupUser();
    const { onAddCreatures } = show("n1");
    expect(screen.getByRole("group", { name: "Add to" })).toHaveTextContent(/^My warbandVermin$/);

    await user.type(screen.getByRole("combobox", { name: "Creature" }), "hound");
    await user.click(screen.getByRole("option", { name: /Warhound/ }));
    await user.clear(screen.getByLabelText("How many"));
    await user.type(screen.getByLabelText("How many"), "3");
    await user.click(screen.getByRole("button", { name: "Add to Vermin" }));

    expect(onAddCreatures).toHaveBeenCalledWith("n1", {
      creature_type: "Warhound",
      count: 3,
      wounds: 2,
      stats: expect.objectContaining({ weapon_skill: 4, toughness: 3 }),
    });
  });

  it("adds a type the bestiary doesn't hold, as typed, with no profile", async () => {
    const user = setupUser();
    const { onAddCreatures } = show("n1");

    await user.type(screen.getByRole("combobox", { name: "Creature" }), "Giant Spider");
    await user.click(screen.getByRole("option", { name: /Use “Giant Spider” as the type/ }));
    await user.click(screen.getByRole("button", { name: "Add to Vermin" }));

    expect(onAddCreatures).toHaveBeenCalledWith("n1", {
      creature_type: "Giant Spider",
      count: 1,
      wounds: 1,
    });
  });

  it("asks for a creature before adding nothing", async () => {
    const user = setupUser();
    const { onAddCreatures } = show("n1");

    await user.click(screen.getByRole("button", { name: "Add to Vermin" }));

    expect(onAddCreatures).not.toHaveBeenCalled();
    expect(screen.getByText("Pick a creature or type one in.")).toBeInTheDocument();
  });
});

describe("Add a unit to my warband", () => {
  it("fills the temporary unit from a bestiary creature", async () => {
    const user = setupUser();
    const { onAddToWarband } = show();

    await user.type(screen.getByRole("combobox", { name: "From the bestiary" }), "hound");
    await user.click(screen.getByRole("option", { name: /Warhound/ }));

    expect(screen.getByLabelText("Name")).toHaveValue("Warhound");
    expect(screen.getByLabelText("Type")).toHaveValue("Warhound");
    expect(screen.getByLabelText("Rating")).toHaveValue(9);
    expect(screen.getByLabelText("WS")).toHaveValue("4");
    expect(screen.getByLabelText("W")).toHaveValue("2");
    await user.click(screen.getByRole("button", { name: "Add to my warband" }));
    expect(onAddToWarband).toHaveBeenCalled();
  });

  it("falls back to the whole form, typed in", async () => {
    const user = setupUser();
    show();

    await user.type(screen.getByLabelText("Name"), "Hans");
    await user.type(screen.getByLabelText("Type"), "Militia");

    expect(screen.getByLabelText("Name")).toHaveValue("Hans");
    expect(screen.getByLabelText("Type")).toHaveValue("Militia");
  });
});
