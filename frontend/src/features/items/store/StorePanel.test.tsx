/**
 * The store: a click on an item's name shows its details above the basket (the price row the
 * warband sees), while Get still opens its acquire form without them; a rare item bought once a
 * search found it; and Add item, whose new item opens in the list ready to buy.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogueListKey } from "@/lib/catalogue-queries";
import { rollDie } from "@/lib/dice";
import { queryKeys } from "@/lib/query-keys";
import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";
import {
  makeTemplateAnswer,
  makeTemplateFighter,
  makeTemplateLine,
  makeTemplateUpgrade,
} from "@/test/template-fixtures";
import { makeHenchmenGroup, makeHero, makeItem, makeSpecial } from "@/test/warband-fixtures";

import type { TemplateLine } from "@/features/warbands/types/hire-template-types";

import type { WeaponMaterial, WhoCan } from "../types/item-types";
import StorePanel from "./StorePanel";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: vi.fn(),
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
  materials: [],
};

function renderStore(heroes: ReturnType<typeof makeHero>[] = []) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(catalogueListKey(CAMPAIGN, "items"), [lance]);
  queryClient.setQueryData(queryKeys.campaign.warbandWhoCan(CAMPAIGN, WARBAND), whoCan);
  renderWithQueryClient(
    <StorePanel
      open
      onOpenChange={vi.fn()}
      campaignId={CAMPAIGN}
      warband={{ id: WARBAND, name: "Clan Eshin", gold: 100 }}
      heroes={heroes}
      henchmenGroups={[]}
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

  it("buys a rare item once a hero's search found it", async () => {
    fakeApi.on(`POST /warbands/${WARBAND}/rarity-rolls/`, { hero_id: 4, warnings: [] });
    fakeApi.on(`POST /warbands/${WARBAND}/purchases/`, {
      target_type: "stash",
      target_id: null,
      updated_at: null,
      items: null,
      stash_item: null,
      trade: null,
      summary: {},
      warnings: [],
    });
    vi.mocked(rollDie).mockReturnValueOnce(5).mockReturnValueOnce(3);
    const user = setupUser();
    renderStore([makeHero({ id: 4, name: "Aldric" })]);

    await user.click(screen.getByRole("button", { name: "Get" }));
    const searchers = within(screen.getByRole("group", { name: "Who searches" }));
    await user.click(searchers.getByRole("button", { name: "Aldric" }));
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("status")).toHaveTextContent("= 8 Found");
    expect(fakeApi.bodyOf(`POST /warbands/${WARBAND}/rarity-rolls/`)).toMatchObject({
      hero_id: 4,
      roll: 8,
      rarity: "Rare 8",
      success: true,
    });
    await user.click(screen.getByRole("button", { name: "Add to basket · 40 gc" }));
    await user.click(screen.getByRole("button", { name: "Buy all" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf(`POST /warbands/${WARBAND}/purchases/`)).toMatchObject({
        item_id: 201,
        quantity: 1,
        availability_id: 21,
        is_buying: true,
        target_type: "stash",
      })
    );
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
// an animal and an oddment nobody's rows name: generally usable, so the store offers them to any unit
const rope = makeItem({
  id: 7,
  name: "Rope & Hook",
  type: "Miscellaneous",
  availabilities: [sold(7, "Rope & Hook", 5).availabilities![0]],
});
const heavy = makeItem({
  ...sold(8, "Heavy Armour", 50),
  type: "Armour",
  subtype: "",
});
const gromrilArmour = makeItem({
  ...sold(9, "Gromril Armour", 150, 11),
  type: "Armour",
  subtype: "",
});
const hisItems = [lance, dagger, sword, whip, rope, heavy, gromrilArmour];
const otto = makeHero({ id: 5, name: "Otto", unit_type: "Champion", fighter_key: "champions" });
const typed = makeHero({ id: 6, name: "Typed", unit_type: "Champion" });
const thugs = makeHenchmenGroup({ id: 8, name: "Thugs", fighter_key: "thugs" });
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
          makeTemplateLine(16, heavy, 50),
        ],
      },
    ],
    fighters: [
      makeTemplateFighter("champions", "Champion", { off_lines: [13] }),
      makeTemplateFighter("thugs", "Thug", { kind: "henchman" }),
    ],
  },
  { variant: "marienburg" }
);

function renderHisStore(
  forUnit: { key: string; name: string },
  /** More lines on his list (a weapon material's), with the materials the server offers. */
  extraLines: TemplateLine[] = [],
  materials: WhoCan["materials"] = [],
  /** Lines of his the server says he isn't meant to take. */
  offLines: number[] = []
) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(catalogueListKey(CAMPAIGN, "items"), [...hisItems]);
  queryClient.setQueryData(queryKeys.campaign.warbandWhoCan(CAMPAIGN, WARBAND), {
    ...whoCan,
    materials,
    items: hisItems.map((item) => ({
      item_id: item.id,
      availability_id: item.availabilities![0].id,
      options: [item.availabilities![0].id],
      can_buy: item !== lance,
      reason: item === lance ? "Not available for Mercenaries." : "",
      always_open: item === rope,
      counts_as: item === gromrilArmour ? [heavy.id] : [],
    })),
  });
  const lists = [
    {
      ...template.template!.lists[0],
      lines: [...template.template!.lists[0].lines, ...extraLines],
    },
  ];
  const fighters = template.template!.fighters.map((fighter) => ({
    ...fighter,
    off_lines: [...fighter.off_lines, ...offLines],
  }));
  queryClient.setQueryData(queryKeys.campaign.warbandHireTemplate(CAMPAIGN, WARBAND), {
    ...template,
    template: { ...template.template!, lists, fighters },
  });
  renderWithQueryClient(
    <StorePanel
      open
      onOpenChange={vi.fn()}
      campaignId={CAMPAIGN}
      warband={{ id: WARBAND, name: "The Silver Hammers", gold: 100 }}
      heroes={[otto, typed]}
      henchmenGroups={[thugs]}
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
  it("starts on Their list: their items as their list names them, at the store's price", async () => {
    const user = setupUser();
    renderHisStore({ key: "heroes:5", name: "Otto" });

    // one switch for a unit with a list (William, 22 Nov 2026)
    expect(screen.getByRole("switch", { name: "Their list" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.queryByRole("switch", { name: "Warband Only" })).toBeNull();
    // the Rope & Hook is nobody's: generally usable, so a hero sees it beside their list's lines;
    // Gromril Armour counts as their Heavy Armour; a line they aren't meant to take is dimmed
    expect(names()).toEqual([
      "Heavy Armour",
      "Jambiya (Dagger)",
      "Rope & Hook",
      "Steel Whip",
      "Sword",
      "Gromril Armour",
    ]);
    expect(screen.getByText("Gaolers only")).toBeInTheDocument();
    expect(screen.getByText("At most 1 in the warband: it would hold 2.")).toBeInTheDocument();

    // Their list off: the warband's usual store, the common kit first; the Lance it can't usually
    // buy stays hidden
    await user.click(screen.getByRole("switch", { name: "Their list" }));
    expect(names()).toEqual([
      "Dagger",
      "Heavy Armour",
      "Rope & Hook",
      "Steel Whip",
      "Sword",
      "Gromril Armour",
    ]);
    expect(screen.queryByText("Gaolers only")).toBeNull();
  });

  it("gives a henchmen group only their list: no oddments, materials or armour that counts as theirs", () => {
    // William, 22 Nov 2026: "A henchman store Their list should literally only show the items
    // from their list, no material, no gromril armour, no misc items not on their list."
    renderHisStore({ key: "henchmen:8", name: "Thugs" }, [], [GROMRIL]);

    expect(names()).toEqual(["Heavy Armour", "Jambiya (Dagger)", "Steel Whip", "Sword"]);
  });

  it("starts a rare search on the variant's bonus", async () => {
    const user = setupUser();
    renderHisStore({ key: "heroes:5", name: "Otto" });
    // Gromril Armour by name, not by position: the store orders the common kit first
    const row = screen
      .getByRole("button", { name: /^Gromril Armour/ })
      .closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Get" }));
    expect(
      within(screen.getByRole("group", { name: "Search bonus" })).getByText("+1")
    ).toBeInTheDocument();
  });

  it("offers a material his list sells with that list's weapons only", async () => {
    // weapon materials (William, 20 Nov 2026): the weapon choices are the other melee weapons on
    // that same equipment list, at the line's own price for each (the server's)
    const user = setupUser();
    renderHisStore(
      { key: "heroes:5", name: "Otto" },
      [
        makeTemplateLine(14, { id: 0, name: "" }, null, {
          item: null,
          shown_as: "Darksteel blade",
          cost_note: "3 × price",
          material: {
            slug: "gromril",
            name: "Gromril",
            prefix: "Gromril",
            rarity: 11,
            price_note: "4 x Price",
            choices: [
              {
                line_id: 12,
                item: { id: 2, name: "Sword", variant: "", type: "Weapon" },
                price: 30,
              },
            ],
          },
        }),
      ],
      [GROMRIL]
    );

    // a material's row sits among the items of its rarity (William, 22 Nov 2026)
    expect(names()).toEqual([
      "Heavy Armour",
      "Jambiya (Dagger)",
      "Rope & Hook",
      "Steel Whip",
      "Sword",
      "Darksteel blade",
      "Gromril Armour",
    ]);
    const row = screen
      .getByRole("button", { name: /Darksteel blade/ })
      .closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Get" }));
    const picker = within(screen.getByRole("group", { name: "Weapon" }));

    expect(picker.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Sword30 gc",
    ]);
  });

  it("dims a material his list sells that he isn't meant to take, with the server's reason", () => {
    // the Shadow Warriors' ithilmar line is "Heroes only": the server says so, the row shows it
    renderHisStore(
      { key: "heroes:5", name: "Otto" },
      [
        makeTemplateLine(15, { id: 0, name: "" }, null, {
          item: null,
          cost_note: "2 × price",
          who: { heroes: true },
          who_text: "Heroes only",
          material: {
            slug: "gromril",
            name: "Gromril",
            prefix: "Gromril",
            rarity: 11,
            price_note: "2 × price",
            choices: [],
          },
        }),
      ],
      [GROMRIL],
      [15]
    );

    expect(screen.getByText("Heroes only")).toBeInTheDocument();
  });

  it("offers a material open to anyone with his own list's weapons", async () => {
    // William, 20 Nov 2026: "a unit can only use the weapons and armour from their list (outside of
    // gromril, ithilmar and material weapons of that same list)"
    const user = setupUser();
    renderHisStore({ key: "heroes:5", name: "Otto" }, [], [GROMRIL]);

    expect(names()).toContain("Gromril Weapon");
    const row = screen.getByRole("button", { name: /Gromril Weapon/ }).closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Get" }));
    const picker = within(screen.getByRole("group", { name: "Weapon" }));

    // his list's melee weapons at four times their price, not every melee weapon in the store
    expect(picker.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Dagger8 gc",
      "Steel Whip40 gc",
      "Sword40 gc",
    ]);
  });

  it("leaves out a material whose setting isn't in play", () => {
    // William, 22 Nov 2026: silver "shouldn't be showing at all when the His List toggle is on"
    renderHisStore({ key: "heroes:5", name: "Otto" }, [], [GROMRIL, SILVER]);
    expect(names()).toContain("Gromril Weapon");
    expect(names()).not.toContain("Silver Weapon");
  });

  it("has only Warband Only for a unit typed by hand", () => {
    renderHisStore({ key: "heroes:6", name: "Typed" });
    expect(screen.queryByRole("switch", { name: "Their list" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Warband Only" })).toBeInTheDocument();
    expect(names()).toEqual([
      "Dagger",
      "Heavy Armour",
      "Rope & Hook",
      "Steel Whip",
      "Sword",
      "Gromril Armour",
    ]);
  });
});

describe("StorePanel, Upgrades for a hero from the template", () => {
  const upgrades = [
    makeTemplateUpgrade(1, "Great Claw", 50, {
      later_double: true,
      later_cost: 100,
      at_recruit: true,
    }),
    makeTemplateUpgrade(2, "Tentacle", 35, {
      later_double: true,
      later_cost: 70,
      at_recruit: true,
    }),
    makeTemplateUpgrade(3, "Mark of Tchar", 0, {
      group: "Mark of the Dark Gods",
      max_per_fighter: 1,
    }),
    makeTemplateUpgrade(4, "Mark of Arkhar", 0, {
      group: "Mark of the Dark Gods",
      max_per_fighter: 1,
      who_text: "Seers only",
    }),
  ];
  const marked = makeHero({
    id: 5,
    name: "Otto",
    unit_type: "Champion",
    fighter_key: "champions",
    specials: [makeSpecial({ id: 200, name: "Tentacle" })],
  });

  function renderUpgrades() {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(catalogueListKey(CAMPAIGN, "items"), [lance]);
    queryClient.setQueryData(queryKeys.campaign.warbandWhoCan(CAMPAIGN, WARBAND), whoCan);
    queryClient.setQueryData(queryKeys.campaign.warbandHireTemplate(CAMPAIGN, WARBAND), {
      ...template,
      template: {
        ...template.template!,
        upgrades,
        fighters: [makeTemplateFighter("champions", "Champion", { off_upgrades: [4] })],
      },
    });
    renderWithQueryClient(
      <StorePanel
        open
        onOpenChange={vi.fn()}
        campaignId={CAMPAIGN}
        warband={{ id: WARBAND, name: "The Silver Hammers", gold: 100 }}
        heroes={[marked]}
        henchmenGroups={[]}
        canBuy
        opening={{ forUnit: { key: "heroes:5", name: "Otto" } }}
      />,
      { queryClient }
    );
  }

  it("finds an upgrade by name without saying nothing in the store has it", async () => {
    const user = setupUser();
    renderUpgrades();
    await user.type(screen.getByRole("searchbox", { name: "Search the store" }), "Mark of Tchar");
    expect(screen.getByRole("button", { name: "Get Mark of Tchar" })).toBeInTheDocument();
    expect(screen.queryByText("Nothing in the store by that name.")).toBeNull();
    await user.type(screen.getByRole("searchbox", { name: "Search the store" }), "zzz");
    expect(screen.getByText("Nothing in the store by that name.")).toBeInTheDocument();
  });

  it("prices each at what it costs him next, with its warnings, and Buy all buys it onto him", async () => {
    fakeApi.on(`POST /warbands/${WARBAND}/heroes/batch/`, {
      units: [marked],
      summary: {},
      warnings: [],
    });
    const user = setupUser();
    renderUpgrades();

    const mutations = screen.getByRole("list", { name: "Mutations" });
    const claw = within(mutations).getAllByRole("listitem")[1];
    expect(claw).toHaveTextContent("Great Claw");
    expect(claw).toHaveTextContent("100 gc"); // he has a Tentacle: the second costs double
    expect(claw).toHaveTextContent("Bought only when recruited.");
    expect(claw).not.toHaveTextContent("They have it already.");
    const tentacle = within(mutations).getAllByRole("listitem")[2];
    expect(tentacle).toHaveTextContent("Tentacle");
    expect(tentacle).toHaveTextContent("They have it already.");
    const theMarks = screen.getByRole("list", { name: "Mark of the Dark Gods" });
    expect(theMarks).toHaveTextContent("Seers only");
    expect(theMarks).toHaveTextContent("free");

    await user.click(screen.getByRole("button", { name: "Get Mark of Tchar" }));
    const [, tchar, arkhar] = within(theMarks).getAllByRole("listitem");
    // only in the basket, and counted once: Buy all gives him one Mark
    expect(tchar).toHaveTextContent("In the basket.");
    expect(tchar).not.toHaveTextContent("They have it already.");
    expect(tchar).not.toHaveTextContent("would have");
    expect(arkhar).toHaveTextContent("At most 1 from Mark of the Dark Gods: they would have 2.");
    await user.click(screen.getByRole("button", { name: "Get Great Claw" }));
    await user.clear(screen.getByLabelText("Price for Great Claw"));
    await user.type(screen.getByLabelText("Price for Great Claw"), "90");
    await user.click(screen.getByRole("button", { name: "Buy all" }));

    await waitFor(() =>
      expect(
        fakeApi
          .requests()
          .filter((request) => request.path === `/warbands/${WARBAND}/heroes/batch/`)
          .map((request) => request.body)
      ).toEqual([
        { upgrades: [{ unit_id: 5, upgrade_id: 3, price: 0 }] },
        { upgrades: [{ unit_id: 5, upgrade_id: 1, price: 90 }] },
      ])
    );
  });
});

// William, 7 Nov 2026: "Store has button to add a new item that opens the the create item modal"
describe("StorePanel, Add item", () => {
  function renderWith(campaign: ReturnType<typeof campaignSummary>) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.campaign.detail(CAMPAIGN), campaign);
    queryClient.setQueryData(catalogueListKey(CAMPAIGN, "items"), [lance]);
    queryClient.setQueryData(catalogueListKey(CAMPAIGN, "item-rules"), []);
    queryClient.setQueryData(queryKeys.campaign.warbandWhoCan(CAMPAIGN, WARBAND), whoCan);
    renderWithQueryClient(
      <StorePanel
        open
        onOpenChange={vi.fn()}
        campaignId={CAMPAIGN}
        warband={{ id: WARBAND, name: "Clan Eshin", gold: 100 }}
        heroes={[]}
        henchmenGroups={[]}
        canBuy
        opening={{}}
      />,
      { queryClient }
    );
  }

  it("is only for whoever may add to the catalogue, as Wargear's Add item", () => {
    renderWith(campaignSummary({ id: CAMPAIGN, role: "player", permissions: [] }));
    expect(screen.queryByRole("button", { name: "Add item" })).toBeNull();
  });

  it("opens the item dialog, and the new campaign item opens in the store, ready to buy", async () => {
    const rope = makeItem({
      id: 300,
      campaign_id: CAMPAIGN,
      name: "Rope and Hook",
      type: "Miscellaneous",
      subtype: "",
      availabilities: [{ ...lance.availabilities![0], id: 31, cost: 5, rarity: null }],
    });
    fakeApi.on("POST /items/", rope);
    fakeApi.on(`GET /warbands/${WARBAND}/who-can/`, {
      ...whoCan,
      items: [
        ...whoCan.items,
        { item_id: 300, availability_id: 31, options: [31], can_buy: true, reason: "" },
      ],
    });
    const user = setupUser();
    renderWith(campaignSummary({ id: CAMPAIGN }));

    await user.click(screen.getByRole("button", { name: "Add item" }));
    const form = await screen.findByRole("dialog", { name: "Add Wargear" });
    await user.type(within(form).getByRole("textbox", { name: /Name/ }), "Rope and Hook");
    await pickOption(user, within(form).getByRole("combobox", { name: "Type" }), "Miscellaneous");
    await user.type(within(form).getByLabelText("Cost (gc)"), "5");
    await user.click(within(form).getByRole("button", { name: "Add item" }));

    expect(fakeApi.bodyOf("POST /items/")).toMatchObject({
      name: "Rope and Hook",
      campaign_id: CAMPAIGN,
    });
    expect(await screen.findByLabelText("Price each for Rope and Hook")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search the store" })).toHaveValue(
      "Rope and Hook"
    );
    expect(names()).toEqual(["Rope and Hook"]);
  });
});

const GROMRIL: WeaponMaterial = {
  slug: "gromril",
  name: "Gromril",
  row_name: "Gromril Weapon",
  prefix: "Gromril",
  for_everyone: true,
  rarity: 11,
  price_note: "4 x Price",
  multiplier: 4,
  addition: null,
  rules: [{ name: "Gromril", text: "A gromril weapon has an extra -1 save modifier." }],
  only: null,
  can_take: true,
  reason: "",
};
const SILVER: WeaponMaterial = {
  ...GROMRIL,
  slug: "silver",
  name: "Silver",
  row_name: "Silver Weapon",
  rarity: 8,
  can_take: false,
  reason: "Grade 3 isn't in this campaign.",
  in_play: false,
};
const OBSIDIAN = {
  ...GROMRIL,
  slug: "obsidian",
  name: "Obsidian",
  row_name: "Obsidian Weapon",
  rarity: 12,
  rules: [],
  can_take: false,
  reason: "Not available for Dwarfs.",
};

function renderMaterialStore(materials = [GROMRIL]) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(catalogueListKey(CAMPAIGN, "items"), [lance]);
  queryClient.setQueryData(queryKeys.campaign.warbandWhoCan(CAMPAIGN, WARBAND), {
    ...whoCan,
    materials,
  });
  renderWithQueryClient(
    <StorePanel
      open
      onOpenChange={vi.fn()}
      campaignId={CAMPAIGN}
      warband={{ id: WARBAND, name: "Clan Eshin", gold: 500 }}
      heroes={[]}
      henchmenGroups={[]}
      canBuy
      opening={{}}
    />,
    { queryClient }
  );
}

/**
 * The weapon materials in the store (weapon materials, William 20 Nov 2026): a row of their own,
 * which picks the weapon when opened. An item is never transformed and a weapon's own form never
 * asks what it is made of.
 */
describe("StorePanel materials", () => {
  it("finds a material by name and prices the weapon picked under it", async () => {
    const user = setupUser();
    renderMaterialStore();

    await user.type(screen.getByRole("searchbox", { name: "Search the store" }), "gromril");
    expect(names()).toEqual(["Gromril Weapon"]);
    const row = screen.getByRole("button", { name: /Gromril Weapon/ });
    expect(row).toHaveTextContent("4 x Price");
    expect(row).toHaveTextContent("Rare 11");

    await user.click(screen.getByRole("button", { name: "Get" }));
    await user.click(
      within(screen.getByRole("group", { name: "Weapon" })).getByRole("button", {
        name: /Lance/,
      })
    );

    // 4 x the Lance's 40 gc, and the material's rarity is the one searched for
    expect(screen.getByLabelText("Price each for Lance")).toHaveValue(160);
    expect(screen.getByRole("group", { name: "Who searches" })).toBeInTheDocument();
  });

  it("shows the material's rules, and the server's reason when it isn't usually allowed", async () => {
    const user = setupUser();
    renderMaterialStore([GROMRIL, OBSIDIAN]);

    // commons first, then by rarity: the Rare 11 material after the Rare 8 Lance
    expect(names()).toEqual(["Lance", "Gromril Weapon"]);
    await user.click(screen.getByRole("switch", { name: "Warband Only" }));
    expect(screen.getByText("Not available for Dwarfs.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Gromril Weapon/ }));

    expect(screen.getByText("A gromril weapon has an extra -1 save modifier.")).toBeInTheDocument();
  });

  it("offers only the weapons a material's own rule allows", async () => {
    // the Dark Elf Blade: William, 20 Nov 2026, "the one just for swords and daggers should only
    // allow those 2", so the picker offers those and names the rule above them
    const user = setupUser();
    renderMaterialStore([
      {
        ...GROMRIL,
        slug: "dark-elf-blade",
        name: "Dark Elf Blade",
        row_name: "Dark Elf Blade",
        prefix: "Dark Elf",
        for_everyone: false,
        only: {
          text: "Only a sword or a dagger may be made with one of these blades.",
          item_ids: [],
        },
      },
    ]);

    const row = screen.getByRole("button", { name: /Dark Elf Blade/ }).closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Get" }));

    expect(
      screen.getByText("Only a sword or a dagger may be made with one of these blades.")
    ).toBeInTheDocument();
    expect(screen.getByText("No melee weapon by that name.")).toBeInTheDocument();
  });

  it("never asks a weapon's own form what it is made of", async () => {
    const user = setupUser();
    renderMaterialStore();

    const row = screen.getByRole("button", { name: /^Lance/ }).closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Get" }));

    expect(screen.getByLabelText("Price each for Lance")).toHaveValue(40);
    expect(screen.queryByRole("group", { name: "Made of" })).not.toBeInTheDocument();
  });
});
