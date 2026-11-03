/**
 * The store: a click on an item's name shows its details above the basket (the price row the
 * warband sees), while Get still opens its acquire form without them.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogueListKey } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeItem } from "@/test/warband-fixtures";

import type { WhoCan } from "../types/item-types";
import StorePanel from "./StorePanel";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const CAMPAIGN = 7;
const WARBAND = 30;
const lance = makeItem({
  id: 201,
  name: "Lance",
  type: "Weapon",
  subtype: "Melee",
  strength: "As user +2",
  flavour: "Only for the mounted.",
  availabilities: [
    {
      id: 21,
      label: "",
      cost: 40,
      dice: null,
      dice_multiplier: null,
      cost_note: "",
      rarity: 8,
      for_everyone: true,
      warbands: [],
      note: "",
    },
  ],
  rules: [
    {
      id: 3,
      rule_id: 8,
      shared: true,
      name: "Cavalry bonus",
      summary: "+2 S when charging on a mount.",
      text: "A mounted model armed with a lance gets +2 Strength on the charge.",
      table: [],
    },
  ],
});
const whoCan: WhoCan = {
  items: [{ item_id: 201, availability_id: 21, options: [21], can_buy: true, reason: "" }],
  hired_swords: [],
  dramatis_personae: [],
  special_skill_ids: [],
};

function renderStore() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(catalogueListKey(CAMPAIGN, "items"), [lance]);
  queryClient.setQueryData(queryKeys.campaign.warbandWhoCan(CAMPAIGN, WARBAND), whoCan);
  renderWithQueryClient(
    <StorePanel
      open
      onOpenChange={vi.fn()}
      campaignId={CAMPAIGN}
      warband={{ id: WARBAND, name: "Clan Eshin", gold: 100 }}
      heroes={[]}
      henchmenGroups={[]}
      hirelings={[]}
      canBuy
      opening={{}}
    />,
    { queryClient }
  );
}

beforeEach(() => fakeApi.reset());

describe("StorePanel", () => {
  it("shows a clicked item's details, and hides them on a second click", async () => {
    const user = setupUser();
    renderStore();

    await user.click(screen.getByRole("button", { name: /^Lance/ }));
    const info = screen.getByRole("region", { name: "Lance" });
    expect(within(info).getByText("As user +2")).toBeInTheDocument();
    expect(within(info).getByText("40 gc")).toBeInTheDocument();
    expect(within(info).getByText("Rare 8")).toBeInTheDocument();
    expect(within(info).getByText("+2 S when charging on a mount.")).toBeInTheDocument();
    expect(info).not.toHaveTextContent("Only for the mounted.");

    await user.click(screen.getByRole("button", { name: /^Lance/ }));
    expect(screen.queryByRole("region", { name: "Lance" })).not.toBeInTheDocument();
  });

  it("opens the acquire form from Get without the details", async () => {
    const user = setupUser();
    renderStore();

    await user.click(screen.getByRole("button", { name: "Get" }));

    expect(screen.getByLabelText("Price each for Lance")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Lance" })).not.toBeInTheDocument();
  });
});
