/**
 * Recruit as (the templates plan, "Add a hero, before the first battle"): the template's heroes
 * with their cost and what the warband has of them, the kit from his lists at list price while
 * list prices are open (his lists to look at afterwards), and the tally, every price editable,
 * which is what the server writes.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeHero } from "@/test/warband-fixtures";

import type {
  TemplateFighter,
  TemplateLine,
  WarbandTemplateAnswer,
} from "../../types/hire-template-types";
import RecruitForm from "./RecruitForm";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("../../api/warband-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/warband-cache")>()),
  useWarbandCacheUpdate: () => () => undefined,
}));

const line = (id: number, name: string, cost: number | null, extra: Partial<TemplateLine> = {}) =>
  ({
    id,
    item: { id: id * 10, name, variant: "", type: "Weapon" },
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
    have: { count: 0, groups: 0 },
    off_lines: [],
    free_item: { id: 10, name: "Dagger" },
    ...extra,
  }) satisfies TemplateFighter;

const answer = (open: boolean): WarbandTemplateAnswer => ({
  variant: "reikland",
  list_prices_open: open,
  template: {
    id: 1,
    campaign_id: null,
    replaces: null,
    name: "Mercenaries",
    gold: 500,
    most_warriors: 15,
    variants: [],
    rules: [],
    missing_rules: 0,
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
  },
});

const ulrich = makeHero({ id: 6, name: "Ulrich", unit_type: "Champion", price: 35 });

function renderForm(onCreated = vi.fn()) {
  renderWithQueryClient(
    <RecruitForm
      kind="hero"
      campaignId={1}
      warbandId={9}
      typeName="Reiklanders"
      gold={74}
      resources={[]}
      existingIds={[]}
      canCreateRace={false}
      onCancel={vi.fn()}
      onCreated={onCreated}
    />
  );
  return onCreated;
}

describe("Recruiting from the warband's template", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("POST /warbands/9/heroes/batch/", { units: [ulrich], summary: {}, warnings: [] });
  });

  it("recruits a Champion with kit at list price, and the tally is what is sent", async () => {
    fakeApi.on("GET /warbands/9/template/", answer(true));
    const onCreated = renderForm();
    const user = setupUser();
    const picker = await screen.findByRole("radiogroup", { name: "Recruit as" });
    expect(within(picker).getByRole("radio", { name: /Youngblood/ })).toHaveTextContent(
      "Already 2 of 2. You can still add one."
    );
    await user.click(within(picker).getByRole("radio", { name: /Champion/ }));
    await user.type(screen.getByLabelText("Name"), "Ulrich");
    await user.click(screen.getByRole("button", { name: "Sword 10" }));
    await user.click(screen.getByRole("button", { name: "Pistol, brace 30" }));
    expect(screen.getByRole("button", { name: /Steel Whip 10/ })).toHaveTextContent(
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

  it("after the first battle shows his lists to look at, and the tally is his cost and the dagger", async () => {
    fakeApi.on("GET /warbands/9/template/", answer(false));
    renderForm();
    const user = setupUser();
    await user.click(await screen.findByRole("radio", { name: /Champion/ }));
    expect(screen.getByText("His lists · Mercenary list")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sword 10" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Recruit" }));
    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /warbands/9/heroes/batch/")).toEqual({
        create: [{ fighter_key: "champions", name: null, price: 35 }],
      })
    );
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
