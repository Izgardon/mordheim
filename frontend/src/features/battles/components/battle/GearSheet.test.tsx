import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import { catalogueListKey } from "@/lib/catalogue-queries";
import { item } from "@/test/catalogue-fixtures";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import GearSheet from "./GearSheet";

const unit = {
  key: "hero:2",
  id: 2,
  kind: "hero",
  displayName: "Black Fang",
  unitType: "Assassin",
  stats: {},
  items: [{ id: 31, name: "Holy Water", count: 1, singleUse: true }],
  singleUseItems: [{ id: 31, name: "Holy Water", quantity: 1 }],
  skills: [],
  spells: [],
  specials: [],
} as unknown as PrebattleUnit;

function renderSheet(canAct: boolean) {
  const onUse = vi.fn();
  renderWithQueryClient(
    <GearSheet
      campaignId={1}
      target={{ unit, tab: "gear" }}
      canAct={canAct}
      usedCount={() => 0}
      busyKey={null}
      onOpenChange={vi.fn()}
      onUse={onUse}
      onUndoUse={vi.fn()}
    />
  );
  return { onUse };
}

describe("GearSheet", () => {
  it("offers Use for a single-use item while the player can act", async () => {
    const user = setupUser();
    const { onUse } = renderSheet(true);

    await user.click(screen.getByRole("button", { name: /Holy Water/ }));
    await user.click(screen.getByRole("button", { name: "Use" }));

    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ key: "hero:2" }), 31);
  });

  it("offers no Use when it cannot act, as another warband's unit opens it", async () => {
    const user = setupUser();
    renderSheet(false);

    await user.click(screen.getByRole("button", { name: /Holy Water/ }));

    expect(screen.getByText(/once per battle/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use" })).toBeNull();
  });
});

describe("the gear quick reference", () => {
  // William, 12 Nov 2026: "gear ref without the fluff"
  it("reads out an item's rules and leaves its flavour on its page", async () => {
    const user = setupUser();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(catalogueListKey(1, "items"), [
      item({
        id: 31,
        name: "Holy Water",
        flavour: "Blessed in the cathedral of Sigmar before the comet fell.",
        rules: [
          {
            id: 9,
            rule_id: null,
            shared: false,
            name: "Thrown",
            summary: "",
            text: "Strength 3, no armour save.",
            table: [],
          },
        ],
      }),
    ]);
    renderWithQueryClient(
      <GearSheet
        campaignId={1}
        target={{ unit, tab: "gear" }}
        canAct={false}
        usedCount={() => 0}
        busyKey={null}
        onOpenChange={vi.fn()}
        onUse={vi.fn()}
        onUndoUse={vi.fn()}
      />,
      { queryClient }
    );

    await user.click(screen.getByRole("button", { name: /Holy Water/ }));

    expect(screen.getByText(/Strength 3, no armour save\./)).toBeInTheDocument();
    expect(screen.queryByText(/Blessed in the cathedral/)).toBeNull();
    expect(screen.queryByText("About")).toBeNull();
  });

  // William, 22 Nov 2026: a beast's rules are its bestiary entry's specials, not item rules
  it("reads out an animal's profile and its beast's specials", async () => {
    const user = setupUser();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(catalogueListKey(1, "items"), [
      item({
        id: 31,
        name: "Polecat",
        type: "Animal",
        bestiary_entry: {
          id: 4,
          name: "Polecat",
          kind: "pet",
          has_profile: true,
          movement: 6,
          weapon_skill: 3,
          ballistic_skill: 0,
          strength: 2,
          toughness: 2,
          wounds: 1,
          initiative: 4,
          attacks: 1,
          leadership: 4,
          armour_save: null,
          specials: [{ id: 8, name: "Cat Friend (Polecat)", description: "Hates cats." }],
        },
      }),
    ]);
    const owner = {
      ...unit,
      items: [{ id: 31, name: "Polecat", count: 1, singleUse: false }],
      singleUseItems: [],
    };
    renderWithQueryClient(
      <GearSheet
        campaignId={1}
        target={{ unit: owner as PrebattleUnit, tab: "gear" }}
        canAct={false}
        usedCount={() => 0}
        busyKey={null}
        onOpenChange={vi.fn()}
        onUse={vi.fn()}
        onUndoUse={vi.fn()}
      />,
      { queryClient }
    );

    await user.click(screen.getByRole("button", { name: /Polecat/ }));

    expect(screen.getByText("Cat Friend (Polecat)")).toBeInTheDocument();
    expect(screen.getByText(/Hates cats\./)).toBeInTheDocument();
    expect(screen.getByText("WS")).toBeInTheDocument();
    expect(screen.queryByText("No rules written down.")).toBeNull();
  });
});
