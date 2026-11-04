/**
 * Reference → Warbands (the templates plan, phase 1b), on the real routes over the fake API
 * server: a row per warband type in play with a template, opening to the template with its
 * type's variant; the variant switch changes the skill groups and the rule pills, a pill opens
 * the warband sheet's rules modal, and the lists show their lines at list prices.
 */
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

import type { WarbandTemplate } from "../types/template-types";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/warband-templates/routes/WarbandTemplates";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const PAGE = `/campaigns/${CAMPAIGN_ID}/warband-templates`;
const type = (id: number, name: string, variant: string, in_play = true) => ({
  id,
  name,
  slug: name.toLowerCase(),
  source_code: "",
  setting_id: null,
  campaign_id: null,
  variant,
  archived: false,
  in_play,
});
const PROFILE = {
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
};
const MERCENARIES: WarbandTemplate = {
  id: 1,
  campaign_id: null,
  setting_id: null,
  name: "Mercenaries",
  slug: "mercenaries",
  starting_gold: 500,
  gold: 500,
  max_models: 15,
  most_warriors: 15,
  variants: [
    { key: "reikland", name: "Reikland" },
    { key: "middenheim", name: "Middenheim", starting_gold: 600 },
  ],
  source: "Mordheim Rulebook",
  link_url: "",
  in_play: true,
  types: [
    type(10, "Reiklanders", "reikland"),
    type(11, "Middenheimers", "middenheim"),
    type(12, "Ostermarkers", "", false),
  ],
  rules: [
    {
      id: 1,
      title: "Reiklander Special rules",
      description: "Marksmen +1 BS.",
      variant: "reikland",
      warband_type_id: null,
    },
    {
      id: 2,
      title: "Middenheimer Special rules",
      description: "S4 heroes.",
      variant: "middenheim",
      warband_type_id: null,
    },
    { id: 3, title: "Reiklander drill", description: "Drill.", variant: "", warband_type_id: 10 },
  ],
  lists: [
    {
      id: 5,
      key: "mercenary-equipment",
      name: "Mercenary Equipment",
      note: "",
      lines: [
        {
          id: 50,
          item: { id: 3, name: "Dagger", variant: "", type: "Weapon" },
          shown_as: "",
          cost: 2,
          cost_note: "",
          first_free: true,
          brace_cost: null,
          who: {},
          warband_max: null,
          note: "",
          variant: "",
          who_text: "",
        },
        {
          id: 51,
          item: { id: 4, name: "Pistol", variant: "", type: "Weapon" },
          shown_as: "",
          cost: 15,
          cost_note: "",
          first_free: false,
          brace_cost: 30,
          who: { heroes: true },
          warband_max: null,
          note: "",
          variant: "",
          who_text: "Heroes only",
        },
        {
          id: 52,
          item: { id: 5, name: "Halberd", variant: "", type: "Weapon" },
          shown_as: "",
          cost: 10,
          cost_note: "",
          first_free: false,
          brace_cost: null,
          who: { fighters: ["champions"] },
          warband_max: null,
          note: "",
          variant: "middenheim",
          who_text: "Champions only",
        },
      ],
    },
  ],
  fighters: [
    {
      ...PROFILE,
      id: 7,
      key: "champions",
      kind: "hero",
      name: "Champion",
      plural: "Champions",
      race_id: 1,
      race: "Human",
      cost: 35,
      starting_xp: 8,
      min_count: 0,
      max_count: 2,
      group_min: null,
      group_max: null,
      skill_types: ["Combat", "Shooting", "Strength"],
      spell_types: [],
      gains_xp: true,
      promotable: true,
      is_leader: false,
      caster: "No",
      large: false,
      variant_changes: {
        middenheim: {
          skill_types: ["Combat", "Strength", "Speed"],
          skills: [{ id: 2, name: "Ride [Animal]" }],
        },
      },
      fixed_kit: "",
      lists: ["mercenary-equipment"],
      rules: [],
    },
  ],
  upgrades: [],
};

const row = (name: string) =>
  screen.findByRole("button", { name: (label) => label.startsWith(name) });
const tags = (label: string) =>
  within(screen.getByRole("article", { name: "Champion" })).getByText(label).parentElement
    ?.textContent;

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignSummary());
  fakeApi.on(`GET /warband-templates/?campaign_id=${CAMPAIGN_ID}`, [MERCENARIES]);
  fakeApi.on("GET /warband-templates/1/", MERCENARIES);
});

afterEach(() => {
  cleanupApps();
  vi.restoreAllMocks();
});

describe("The Warbands page", () => {
  it("is a row per warband type in play with a template", async () => {
    renderApp(PAGE);
    // a variant's own starting gold (Marienburg's 600 gc in the book)
    expect(await row("Middenheimers")).toHaveTextContent("MiddenheimersMercenaries600 gc15");
    expect(await row("Reiklanders")).toHaveTextContent("ReiklandersMercenaries500 gc15");
    expect(
      screen.queryByRole("button", { name: (label) => label.startsWith("Ostermarkers") })
    ).toBeNull();
    expect(screen.getByText("2 warband types")).toBeInTheDocument();
  });

  it("opens to the template in its type's variant, and the switch shows another's", async () => {
    const user = setupUser();
    renderApp(PAGE);
    await user.click(await row("Middenheimers"));

    expect(await screen.findByRole("article", { name: "Champion" })).toHaveTextContent(
      "35 gc · 0–2"
    );
    expect(tags("Skills")).toBe("SkillsCombatStrengthSpeed");
    expect(tags("Starts with")).toBe("Starts withRide [Animal]");
    expect(screen.getByRole("button", { name: "Middenheim" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Middenheimer Special rules" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reiklander Special rules" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reiklander drill" })).toBeNull(); // the Reiklanders' own

    await user.click(screen.getByRole("button", { name: "Reikland" }));
    expect(tags("Skills")).toBe("SkillsCombatShootingStrength");
    expect(
      within(screen.getByRole("article", { name: "Champion" })).queryByText("Starts with")
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Reiklander Special rules" }));
    expect(
      await screen.findByRole("article", { name: "Reiklander Special rules" })
    ).toHaveTextContent("Marksmen +1 BS.");
    expect(screen.queryByRole("button", { name: "Add rule" })).toBeNull(); // read only
  });

  it("lists each line at its list price, with who may take it", async () => {
    const user = setupUser();
    renderApp(PAGE);
    await user.click(await row("Reiklanders"));
    const list = await screen.findByRole("list", { name: "Mercenary Equipment" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((line) => line.textContent)
    ).toEqual(["Dagger1st free / 2 gc", "Pistol15 gc, brace 30Heroes only"]);
  });

  it("shows a variant's own line only in that variant", async () => {
    const user = setupUser();
    renderApp(PAGE);
    await user.click(await row("Middenheimers"));
    const list = await screen.findByRole("list", { name: "Mercenary Equipment" });
    expect(within(list).getByText("Halberd")).toBeInTheDocument();
    expect(within(list).getByText("Champions only")).toBeInTheDocument(); // the server's words
    await user.click(screen.getByRole("button", { name: "Reikland" }));
    expect(within(list).queryByText("Halberd")).toBeNull();
  });
});
