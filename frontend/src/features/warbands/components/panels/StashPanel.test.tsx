/**
 * The stash: a click on an item shows its details at the foot of the panel (again hides them,
 * another item switches), while Equip, under its Heroes and Henchmen headings, moves the item
 * without opening them.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WhoCan } from "@/features/items/types/item-types";
import { catalogueListKey } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";
import { makeHenchmenGroup, makeHero, makeItem, makeStashItem } from "@/test/warband-fixtures";

import type { RosterUnit } from "../roster/unit-view";
import StashPanel from "./StashPanel";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const CAMPAIGN = 7;
const WARBAND = 30;
const price = (id: number, cost: number, rarity: number | null) => ({
  id,
  label: "",
  cost,
  dice: null,
  dice_multiplier: null,
  cost_note: "",
  rarity,
  for_everyone: true,
  warbands: [],
  note: "",
});
const sword = makeItem({
  id: 101,
  name: "Sword",
  type: "Weapon",
  subtype: "Melee",
  strength: "As user",
  flavour: "A trusty blade.",
  availabilities: [price(9, 10, null)],
  rules: [
    {
      id: 1,
      rule_id: 5,
      shared: true,
      name: "Parry",
      summary: "Parries one blow.",
      text: "Roll a D6 against the highest attack.",
      table: [],
    },
  ],
});
const halberd = makeItem({
  id: 102,
  name: "Halberd",
  type: "Weapon",
  subtype: "Melee",
  availabilities: [price(11, 10, null), price(12, 25, 6)],
});
const whoCan: WhoCan = {
  items: [
    { item_id: 101, availability_id: 9, options: [9], can_buy: true, reason: "" },
    { item_id: 102, availability_id: 12, options: [12], can_buy: true, reason: "" },
  ],
  hired_swords: [],
  dramatis_personae: [],
  skill_group_ids: [],
  special_skill_ids: [],
};
const units: RosterUnit[] = [
  { kind: "henchmen_group", unit: makeHenchmenGroup({ id: 5, name: "Verminkin Pack" }) },
  { kind: "hero", unit: makeHero({ id: 1, name: "Vrask the Hidden" }) },
  { kind: "hero", unit: makeHero({ id: 2, name: "Krekk Blackfur" }) },
] as RosterUnit[];

function renderStash(onMove = vi.fn()) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.campaign.warbandStash(CAMPAIGN, WARBAND), [
    makeStashItem({ id: 101, name: "Sword", cost: 10 }),
    makeStashItem({ id: 102, name: "Halberd", cost: 10, quantity: 2 }),
  ]);
  queryClient.setQueryData(catalogueListKey(CAMPAIGN, "items"), [sword, halberd]);
  queryClient.setQueryData(queryKeys.campaign.warbandWhoCan(CAMPAIGN, WARBAND), whoCan);
  renderWithQueryClient(
    <StashPanel
      campaignId={CAMPAIGN}
      warbandId={WARBAND}
      open
      onOpenChange={vi.fn()}
      canEdit
      units={units}
      onMove={onMove}
      onSell={vi.fn()}
    />,
    { queryClient }
  );
  return onMove;
}

beforeEach(() => fakeApi.reset());

describe("StashPanel", () => {
  it("shows a clicked item's details at the foot, switches to another and hides on a second click", async () => {
    const user = setupUser();
    renderStash();

    await user.click(screen.getByRole("button", { name: /^Sword/ }));
    const info = screen.getByRole("region", { name: "Sword" });
    expect(within(info).getByText("As user")).toBeInTheDocument();
    expect(within(info).getByText("10 gc")).toBeInTheDocument();
    expect(within(info).getByText("Common")).toBeInTheDocument();
    expect(within(info).getByText("Parry")).toBeInTheDocument();
    expect(within(info).getByText("Parries one blow.")).toBeInTheDocument();
    expect(info).not.toHaveTextContent("A trusty blade.");
    expect(screen.getByRole("button", { name: /^Sword/ })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: /^Halberd/ }));
    expect(screen.queryByRole("region", { name: "Sword" })).not.toBeInTheDocument();
    // the price row the server picks for the warband
    const halberdInfo = screen.getByRole("region", { name: "Halberd" });
    expect(within(halberdInfo).getByText("25 gc")).toBeInTheDocument();
    expect(within(halberdInfo).getByText("Rare 6")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Halberd/ }));
    expect(screen.queryByRole("region", { name: "Halberd" })).not.toBeInTheDocument();
  });

  it("equips from its sectioned dropdown without opening the details", async () => {
    const user = setupUser();
    const onMove = renderStash();

    const equip = screen.getByRole("combobox", { name: "Equip Sword" });
    await user.click(equip);
    expect(screen.getByRole("group", { name: "Heroes" })).toHaveTextContent(
      "Vrask the HiddenKrekk Blackfur"
    );
    expect(screen.getByRole("group", { name: "Henchmen" })).toHaveTextContent("Verminkin Pack");
    expect(screen.queryByRole("group", { name: "Hired swords" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await pickOption(user, equip, "Krekk Blackfur");

    expect(onMove).toHaveBeenCalledWith(101, { type: "hero", id: 2 }, 1);
    expect(screen.queryByRole("region", { name: "Sword" })).not.toBeInTheDocument();
  });
});
