/**
 * Recruit as (the templates plan, "Add a hero, before the first battle"): the template's heroes
 * with their cost and what the warband has of them, the kit from his lists at list price while
 * list prices are open (his lists to look at afterwards), and the tally, every price editable,
 * which is what the server writes.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogueListKey } from "@/lib/catalogue-queries";
import { bestiaryEntry } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeHero } from "@/test/warband-fixtures";

import type {
  TemplateFighter,
  TemplateLine,
  WarbandTemplateAnswer,
} from "../../types/hire-template-types";
import { PurseContext } from "../../purse";
import RecruitForm from "./RecruitForm";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
const media = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => media.mobile }));
vi.mock("../../api/warband-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/warband-cache")>()),
  useWarbandCacheUpdate: () => () => undefined,
}));

const line = (id: number, name: string, cost: number | null, extra: Partial<TemplateLine> = {}) =>
  ({
    id,
    item: { id: id * 10, name, variant: "", type: "Weapon" },
    material: null,
    shown_as: "",
    cost,
    cost_note: "",
    first_free: false,
    brace_cost: null,
    who: {},
    who_text: "",
    warband_max: null,
    held: null,
    note: "",
    variant: "",
    ...extra,
  }) satisfies TemplateLine;

const fighter = (key: string, name: string, cost: number, extra: Partial<TemplateFighter> = {}) =>
  ({
    id: cost,
    key,
    kind: "hero",
    name,
    plural: `${name}s`,
    race_id: 1,
    race: "Human",
    cost,
    starting_xp: 8,
    min_count: 0,
    max_count: 2,
    group_min: null,
    group_max: null,
    movement: 4,
    weapon_skill: 4,
    ballistic_skill: 3,
    strength: 3,
    toughness: 3,
    wounds: 1,
    initiative: 3,
    attacks: 1,
    leadership: 7,
    written_stats: {},
    skill_types: ["Combat", "Shooting", "Strength"],
    spell_types: [],
    gains_xp: true,
    promotable: true,
    is_leader: false,
    caster: "No",
    large: false,
    fixed_kit: "",
    lists: ["mercenary"],
    rules: [],
    skills: [],
    have: { count: 0, groups: 0 },
    off_lines: [],
    off_upgrades: [],
    free_items: [{ id: 10, name: "Dagger" }],
    ...extra,
  }) satisfies TemplateFighter;

const answer = (open: boolean): WarbandTemplateAnswer => ({
  variant: "reikland",
  list_prices_open: open,
  missing_rules: 0,
  no_list: false,
  template: {
    id: 1,
    campaign_id: null,
    replaces: null,
    name: "Mercenaries",
    gold: 500,
    most_warriors: 15,
    variants: [],
    rules: [],
    lists: [
      {
        id: 1,
        key: "mercenary",
        name: "Mercenary list",
        note: "",
        lines: [
          line(1, "Dagger", 2, { first_free: true }),
          line(2, "Sword", 10),
          line(3, "Pistol", 15, { brace_cost: 30 }),
          line(4, "Steel Whip", 10, { who_text: "Gaolers only" }),
        ],
      },
    ],
    fighters: [
      fighter("champions", "Champion", 35, { off_lines: [4] }),
      fighter("youngbloods", "Youngblood", 15, { have: { count: 2, groups: 0 } }),
    ],
    upgrades: [],
  },
});

const ulrich = makeHero({ id: 6, name: "Ulrich", unit_type: "Champion", price: 35 });

function renderForm(onCreated = vi.fn(), purse: "Gold" | "Budget" = "Gold") {
  renderWithQueryClient(
    <PurseContext.Provider value={purse}>
      <RecruitForm
        kind="hero"
        campaignId={1}
        warbandId={9}
        typeName="Reiklanders"
        gold={74}
        existingIds={[]}
        canCreateRace={false}
        onCancel={vi.fn()}
        onCreated={onCreated}
      />
    </PurseContext.Provider>
  );
  return onCreated;
}

describe("Recruiting from the warband's template", () => {
  beforeEach(() => {
    fakeApi.reset();
    media.mobile = false;
    fakeApi.on("POST /warbands/9/heroes/batch/", { units: [ulrich], summary: {}, warnings: [] });
  });

  it("recruits a Champion with kit at list price, and the tally is what is sent", async () => {
    fakeApi.on("GET /warbands/9/template/", answer(true));
    const onCreated = renderForm();
    const user = setupUser();
    const picker = await screen.findByRole("radiogroup", { name: "Recruit as" });
    expect(within(picker).getByRole("radio", { name: /Youngblood/ })).toHaveTextContent(
      "Already 2 of 2."
    );
    await user.click(within(picker).getByRole("radio", { name: /Champion/ }));
    await user.type(screen.getByLabelText("Name"), "Ulrich");
    await user.click(screen.getByRole("button", { name: "Sword 10 gc" }));
    await user.click(screen.getByRole("button", { name: "Pistol, brace 30 gc" }));
    expect(screen.getByRole("button", { name: /Steel Whip 10 gc/ })).toHaveTextContent(
      "(Gaolers only)"
    );

    const tally = screen.getByRole("list", { name: "Tally" });
    expect(within(tally).getByText("free")).toBeInTheDocument();
    expect(screen.getByText("75 gc")).toBeInTheDocument();
    expect(screen.getByText("Gold 74 → -1 gc")).toBeInTheDocument();
    await user.clear(within(tally).getByLabelText("Price for Champion"));
    await user.type(within(tally).getByLabelText("Price for Champion"), "30");
    expect(screen.getByText("Gold 74 → 4 gc")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Recruit" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("hero-6"));
    const bought = { create_index: 0, quantity: 1, availability_id: null, is_buying: true };
    expect(fakeApi.bodyOf("POST /warbands/9/heroes/batch/")).toEqual({
      create: [{ fighter_key: "champions", name: "Ulrich", price: 30 }],
      purchases: [
        { ...bought, item_id: 20, price: 10 },
        { ...bought, item_id: 30, price: 15 },
        { ...bought, item_id: 30, price: 15 },
      ],
    });
  });

  it("buys a weapon from his list made of the material its line sells", async () => {
    // weapon materials: the Dwarf lists' gromril weapon at three times the price, the weapon picked
    // from the other melee weapons on that same list (William, 20 Nov 2026)
    const base = answer(true);
    const gromril = line(5, "Gromril", null, {
      item: null,
      cost_note: "3 × price",
      material: {
        slug: "gromril",
        name: "Gromril",
        prefix: "Gromril",
        rarity: 11,
        price_note: "3 × price", // the line's own terms, which the server words
        choices: [
          { line_id: 2, item: { id: 20, name: "Sword", variant: "", type: "Weapon" }, price: 30 },
        ],
      },
    });
    const lists = [
      { ...base.template!.lists[0], lines: [...base.template!.lists[0].lines, gromril] },
    ];
    fakeApi.on("GET /warbands/9/template/", { ...base, template: { ...base.template!, lists } });
    renderForm();
    const user = setupUser();
    await user.click(await screen.findByRole("radio", { name: /Champion/ }));

    await user.click(screen.getByRole("button", { name: /Gromril Weapon · 3 × price/ }));
    await user.click(screen.getByRole("button", { name: "Gromril Sword 30 gc" }));

    const tally = screen.getByRole("list", { name: "Tally" });
    expect(within(tally).getByLabelText("Price for Gromril Sword")).toHaveValue(30);
    await user.type(screen.getByLabelText("Name"), "Ulrich");
    await user.click(screen.getByRole("button", { name: "Recruit" }));
    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /warbands/9/heroes/batch/")).toMatchObject({
        purchases: [
          {
            create_index: 0,
            item_id: 20,
            material: "gromril",
            price: 30,
            quantity: 1,
            is_buying: true,
          },
        ],
      })
    );
  });

  it("after the first battle shows his lists to look at, and the tally is his cost and the dagger", async () => {
    fakeApi.on("GET /warbands/9/template/", answer(false));
    renderForm();
    const user = setupUser();
    await user.click(await screen.findByRole("radio", { name: /Champion/ }));
    expect(screen.getByText("Their lists · Mercenary list")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sword 10 gc" })).toBeNull();
    await user.type(screen.getByLabelText("Name"), "Ulrich");
    await user.click(screen.getByRole("button", { name: "Recruit" }));
    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /warbands/9/heroes/batch/")).toEqual({
        create: [{ fighter_key: "champions", name: "Ulrich", price: 35 }],
      })
    );
  });

  // William, 26 Nov 2026: "Block it, needs a name"
  it("won't recruit a fighter from the template without a name", async () => {
    fakeApi.on("GET /warbands/9/template/", answer(false));
    const onCreated = renderForm();
    const user = setupUser();
    await user.click(await screen.findByRole("radio", { name: /Champion/ }));
    await user.click(screen.getByRole("button", { name: "Recruit" }));

    expect(screen.getByText("Name is needed.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(fakeApi.countOf("POST /warbands/9/heroes/batch/")).toBe(0);
    await user.type(screen.getByLabelText("Name"), "Ulrich");
    expect(screen.queryByText("Name is needed.")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Recruit" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("hero-6"));
  });

  it("gives one of each item his lists mark 1st free, and charges for none", async () => {
    // William, 6 Nov 2026: the Gnoblars' list marks both the Dagger and Sharp Stuff "1st free"
    const base = answer(true);
    const gnoblar = fighter("champions", "Champion", 35, {
      free_items: [
        { id: 10, name: "Dagger" },
        { id: 11, name: "Sharp Stuff" },
      ],
    });
    fakeApi.on("GET /warbands/9/template/", {
      ...base,
      template: base.template && { ...base.template, fighters: [gnoblar] },
    });
    renderForm();
    const user = setupUser();
    await user.click(await screen.findByRole("radio", { name: /Champion/ }));
    const tally = screen.getByRole("list", { name: "Tally" });
    expect(within(tally).getAllByText("free")).toHaveLength(2);
    expect(within(tally).getByText("Sharp Stuff")).toBeInTheDocument();
    expect(screen.getByText("Gold 74 → 39 gc")).toBeInTheDocument();
  });

  it("tallies against a workshop warband's Budget rather than its Gold", async () => {
    fakeApi.on("GET /warbands/9/template/", answer(false));
    renderForm(vi.fn(), "Budget");
    const user = setupUser();
    await user.click(await screen.findByRole("radio", { name: /Champion/ }));
    expect(screen.getByText("Budget 74 → 39 gc")).toBeInTheDocument();
    expect(screen.queryByText(/^Gold /)).toBeNull();
  });

  it("focuses the fighter picked: the list folds away, Change brings it back", async () => {
    // William, 12 Nov: "when you click a unit it should minimise the unit list section"
    fakeApi.on("GET /warbands/9/template/", answer(true));
    renderForm();
    const user = setupUser();
    await user.click(await screen.findByRole("radio", { name: /Champion/ }));
    expect(screen.queryByRole("radiogroup", { name: "Recruit as" })).toBeNull();
    expect(screen.queryByText("Someone not in the template")).toBeNull();
    const chosen = screen.getByRole("article", { name: "Champion" });
    expect(within(chosen).getByText("35 gc")).toBeInTheDocument();
    expect(within(chosen).getByText("0 of 0–2 · 8 XP · Human")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByRole("radiogroup", { name: "Recruit as" })).toBeInTheDocument();
  });

  it("shows the chosen fighter's skill groups, starting skills and rules", async () => {
    const base = answer(true);
    const champion = fighter("champions", "Champion", 35, {
      is_leader: true,
      skills: [{ id: 7, name: "Hunter", description: "He may re-roll a missed shot." }],
      rules: [{ id: 8, name: "Fear", kind: "bane", category: "aura", description: "Terrifying." }],
    });
    fakeApi.on("GET /warbands/9/template/", {
      ...base,
      template: base.template && { ...base.template, fighters: [champion] },
    });
    renderForm();
    const user = setupUser();
    await user.click(await screen.findByRole("radio", { name: /Champion/ }));
    const chosen = screen.getByRole("article", { name: "Champion" });
    expect(within(chosen).getByText("Leader", { exact: false })).toBeInTheDocument();
    for (const group of ["Combat", "Shooting", "Strength"]) {
      expect(within(chosen).getByText(group)).toBeInTheDocument();
    }
    expect(within(chosen).getByText("Starts with: Hunter")).toBeInTheDocument();
    expect(within(chosen).getByText("He may re-roll a missed shot.")).toBeInTheDocument();
    expect(within(chosen).getByText("Rules: Fear")).toBeInTheDocument();
  });

  it("groups the kit by the item's type and prices it in gc", async () => {
    // William, 12 Nov: "separated by the items type with their prices listed still in gc"
    const base = answer(true);
    const lists = [
      {
        id: 1,
        key: "mercenary",
        name: "Mercenary list",
        note: "",
        lines: [
          line(1, "Sword", 10),
          line(2, "Helmet", 10, { item: { id: 20, name: "Helmet", variant: "", type: "Armour" } }),
          line(3, "Axe", 5),
        ],
      },
    ];
    fakeApi.on("GET /warbands/9/template/", {
      ...base,
      template: base.template && { ...base.template, lists },
    });
    renderForm();
    const user = setupUser();
    await user.click(await screen.findByRole("radio", { name: /Champion/ }));
    const weapons = screen.getByRole("group", { name: "Weapon" });
    expect(
      within(weapons)
        .getAllByRole("button")
        .map((chip) => chip.textContent)
    ).toEqual(["Sword 10 gc", "Axe 5 gc"]);
    const armour = screen.getByRole("group", { name: "Armour" });
    expect(
      within(armour)
        .getAllByRole("button")
        .map((chip) => chip.textContent)
    ).toEqual(["Helmet 10 gc"]);
    expect(screen.queryByText(/more$/)).toBeNull();
  });

  it("keeps the hand-typed recruit for someone not in the template", async () => {
    fakeApi.on("GET /warbands/9/template/", answer(true));
    renderForm();
    const user = setupUser();
    await user.click(await screen.findByRole("radio", { name: "Someone not in the template" }));
    expect(screen.getByRole("form", { name: "Recruit" })).toBeInTheDocument();
    expect(screen.getByLabelText("Type")).toBeInTheDocument();
  });
});

/**
 * William, 12 Nov 2026: adding a unit to your own warband offers the same creature search the
 * battle's add sheets do, with what is typed used as it stands. The creature is still bought in
 * the store to come with its profile (`beasts.py` recruits it from its Animal item), so the
 * search names the type and says so; it recruits nothing by itself.
 */
describe("The hand-typed recruit's creature search", () => {
  const renderByHand = () => {
    const onCreated = vi.fn();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(catalogueListKey(1, "bestiary"), [
      bestiaryEntry(),
      bestiaryEntry({ id: 6, name: "Warhorse", kind: "mount" }),
    ]);
    renderWithQueryClient(
      <RecruitForm
        kind="henchmen_group"
        campaignId={1}
        warbandId={9}
        typeName="Reiklanders"
        gold={74}
        existingIds={[]}
        canCreateRace={false}
        onCancel={vi.fn()}
        onCreated={onCreated}
      />,
      { queryClient }
    );
    return onCreated;
  };

  beforeEach(() => {
    fakeApi.reset();
    media.mobile = false;
    fakeApi.on("GET /warbands/9/template/", {
      template: null,
      variant: "",
      list_prices_open: true,
    });
    fakeApi.on("POST /warbands/9/henchmen-groups/batch/", {
      units: [{ id: 3 }],
      summary: {},
      warnings: [],
    });
  });

  it("names the type from a creature, and points at the store for its profile", async () => {
    const user = setupUser();
    renderByHand();

    await user.type(await screen.findByLabelText("Type"), "hound");
    await user.click(screen.getByRole("option", { name: /Warhound/ }));

    expect(screen.getByText(/Bought in the store, Warhound comes with its profile/)).toBeTruthy();
    await user.type(screen.getByLabelText("Name"), "The Pack");
    await user.click(screen.getByRole("button", { name: "Recruit" }));
    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /warbands/9/henchmen-groups/batch/")).toMatchObject({
        create: [{ name: "The Pack", unit_type: "Warhound", henchmen: [{ name: "Warhound 1" }] }],
      })
    );
  });

  // William, 26 Nov 2026: "Block it, needs a name"
  it("won't recruit without a name, and sends no type left out, never null", async () => {
    const user = setupUser();
    const onCreated = renderByHand();

    await user.click(await screen.findByRole("button", { name: "Recruit" }));
    expect(screen.getByText("Name is needed.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(fakeApi.countOf("POST /warbands/9/henchmen-groups/batch/")).toBe(0);

    await user.type(screen.getByLabelText("Name"), "  Bravos ");
    expect(screen.queryByText("Name is needed.")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Recruit" }));
    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /warbands/9/henchmen-groups/batch/")).toEqual({
        create: [
          { name: "Bravos", race: null, price: 0, xp: 0, henchmen: [{ name: "Henchman 1" }] },
        ],
      })
    );
    expect(onCreated).toHaveBeenCalledWith("henchmen_group-3");
  });

  it("refuses a name of spaces alone", async () => {
    const user = setupUser();
    renderByHand();

    await user.type(await screen.findByLabelText("Name"), "   ");
    await user.click(screen.getByRole("button", { name: "Recruit" }));
    expect(screen.getByText("Name is needed.")).toBeInTheDocument();
    expect(fakeApi.countOf("POST /warbands/9/henchmen-groups/batch/")).toBe(0);
  });

  it("offers creatures only, and takes a type of its own as typed", async () => {
    const user = setupUser();
    renderByHand();

    await user.type(await screen.findByLabelText("Type"), "War");
    expect(screen.queryByRole("option", { name: /Warhorse/ })).toBeNull();
    await user.click(screen.getByRole("option", { name: /Use “War” as the type/ }));

    expect(screen.queryByText(/Bought in the store/)).toBeNull();
    await user.type(screen.getByLabelText("Name"), "Wolves");
    await user.click(screen.getByRole("button", { name: "Recruit" }));
    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /warbands/9/henchmen-groups/batch/")).toMatchObject({
        create: [{ unit_type: "War" }],
      })
    );
  });
});

describe("Recruiting on a phone", () => {
  it("opens as a bottom sheet with Recruit as, the kit and the tally inside", async () => {
    fakeApi.reset();
    media.mobile = true;
    fakeApi.on("GET /warbands/9/template/", answer(true));
    const onCancel = vi.fn();
    renderWithQueryClient(
      <RecruitForm
        kind="hero"
        campaignId={1}
        warbandId={9}
        typeName="Reiklanders"
        gold={74}
        existingIds={[]}
        canCreateRace={false}
        onCancel={onCancel}
        onCreated={vi.fn()}
      />
    );
    const user = setupUser();
    const sheet = await screen.findByRole("dialog", { name: "Add a hero" });
    await user.click(await within(sheet).findByRole("radio", { name: /Champion/ }));
    expect(within(sheet).getByRole("button", { name: "Sword 10 gc" })).toBeInTheDocument();
    expect(within(sheet).getByRole("list", { name: "Tally" })).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    media.mobile = false;
  });
});
