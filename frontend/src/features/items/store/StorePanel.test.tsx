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
import {
  makeTemplateAnswer,
  makeTemplateFighter,
  makeTemplateLine,
} from "@/test/template-fixtures";
import { makeHero, makeItem } from "@/test/warband-fixtures";

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
  skill_group_ids: [],
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

const sold = (id: number, name: string, cost: number, rarity: number | null = null) =>
  makeItem({
    id,
    name,
    type: "Weapon",
    subtype: "Melee",
    availabilities: [
      {
        id: id * 10,
        label: "",
        cost,
        dice: null,
        dice_multiplier: null,
        cost_note: "",
        rarity,
        for_everyone: true,
        warbands: [],
        note: "",
      },
    ],
  });
const dagger = sold(1, "Dagger", 2);
const sword = sold(2, "Sword", 10);
const whip = sold(3, "Steel Whip", 10);
const otto = makeHero({ id: 5, name: "Otto", unit_type: "Champion", fighter_key: "champions" });
const typed = makeHero({ id: 6, name: "Typed", unit_type: "Champion" });
const template = makeTemplateAnswer(
  {
    variants: [{ key: "marienburg", name: "Marienburg", rare_bonus: 1 }],
    lists: [
      {
        id: 1,
        key: "kit",
        name: "Kit",
        note: "",
        lines: [
          makeTemplateLine(11, dagger, 2, { shown_as: "Jambiya", first_free: true }),
          makeTemplateLine(12, sword, 10, { warband_max: 1, held: 1 }),
          makeTemplateLine(13, whip, 10, { who_text: "Gaolers only" }),
        ],
      },
    ],
    fighters: [makeTemplateFighter("champions", "Champion", { off_lines: [13] })],
  },
  { variant: "marienburg" }
);

function renderHisStore(forUnit: { key: string; name: string }) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(catalogueListKey(CAMPAIGN, "items"), [lance, dagger, sword, whip]);
  queryClient.setQueryData(queryKeys.campaign.warbandWhoCan(CAMPAIGN, WARBAND), {
    ...whoCan,
    items: [lance, dagger, sword, whip].map((item) => ({
      item_id: item.id,
      availability_id: item.availabilities![0].id,
      options: [item.availabilities![0].id],
      can_buy: item !== whip,
      reason: item === whip ? "Not usually available to Mercenaries." : "",
    })),
  });
  queryClient.setQueryData(queryKeys.campaign.warbandHireTemplate(CAMPAIGN, WARBAND), template);
  renderWithQueryClient(
    <StorePanel
      open
      onOpenChange={vi.fn()}
      campaignId={CAMPAIGN}
      warband={{ id: WARBAND, name: "The Silver Hammers", gold: 100 }}
      heroes={[otto, typed]}
      henchmenGroups={[]}
      hirelings={[]}
      canBuy
      opening={{ forUnit }}
    />,
    { queryClient }
  );
}

const names = () =>
  screen
    .getAllByRole("listitem")
    .map((row) => row.querySelector(".item-name")?.textContent)
    .filter(Boolean);

describe("StorePanel, buying for a unit from the template", () => {
  it("starts on His list: his items as his list names them, at the store's price", async () => {
    const user = setupUser();
    renderHisStore({ key: "heroes:5", name: "Otto" });

    expect(screen.getByRole("switch", { name: "His list" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(names()).toEqual(["Jambiya (Dagger)", "Sword"]);
    expect(screen.getByText("At most 1 in the warband: it would hold 2.")).toBeInTheDocument();

    // What I can buy off: a line he isn't meant to take shows dimmed with its reason
    await user.click(screen.getByRole("switch", { name: "What I can buy" }));
    expect(names()).toEqual(["Jambiya (Dagger)", "Sword", "Steel Whip"]);
    expect(screen.getByText("Gaolers only")).toBeInTheDocument();

    // His list off: the store as it always is
    await user.click(screen.getByRole("switch", { name: "His list" }));
    expect(names()).toEqual(["Lance", "Dagger", "Sword", "Steel Whip"]);
    expect(screen.queryByText("Gaolers only")).toBeNull();
  });

  it("starts a rare search on the variant's bonus", async () => {
    const user = setupUser();
    renderHisStore({ key: "heroes:5", name: "Otto" });
    await user.click(screen.getByRole("switch", { name: "His list" }));
    const row = screen.getAllByRole("listitem")[0];
    await user.click(within(row).getByRole("button", { name: "Get" }));
    expect(
      within(screen.getByRole("group", { name: "Search bonus" })).getByText("+1")
    ).toBeInTheDocument();
  });

  it("has no His list for a unit typed by hand", () => {
    renderHisStore({ key: "heroes:6", name: "Typed" });
    expect(screen.queryByRole("switch", { name: "His list" })).toBeNull();
    expect(names()).toEqual(["Lance", "Dagger", "Sword"]);
  });
});
