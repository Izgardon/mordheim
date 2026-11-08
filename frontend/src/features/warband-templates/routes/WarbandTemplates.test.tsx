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
          skills: [{ id: 2, name: "Ride [Animal]", description: "Rides the animal." }],
        },
      },
      fixed_kit: "",
      lists: ["mercenary-equipment"],
      rules: [],
      skills: [{ id: 5, name: "Hunter", description: "Fires each turn." }],
    },
  ],
  upgrades: [],
};

const row = (name: string) =>
  screen.findByRole("button", { name: (label) => label.startsWith(name) });
/** The rows' names, in the page's order. */
const rowNames = () =>
  [
    ...document.querySelectorAll<HTMLElement>('li[id^="ref-"] > button > span > span:first-child'),
  ].map((name) => name.textContent);
const param = (app: ReturnType<typeof renderApp>, key: string) =>
  new URLSearchParams(app.location().search).get(key);
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
    // William, 7 Nov 2026: "drop starting gold and most warriors ... add Setting column"
    expect(await row("Middenheimers")).toHaveTextContent("MiddenheimersMercenariesMordheim");
    expect(await row("Reiklanders")).toHaveTextContent("ReiklandersMercenariesMordheim");
    expect(
      screen.queryByRole("button", { name: (label) => label.startsWith("Ostermarkers") })
    ).toBeNull();
    expect(screen.getByText("2 warband types")).toBeInTheDocument();
    expect(screen.queryByText("Starting gold")).toBeNull();
    expect(screen.queryByText("Most warriors")).toBeNull();
  });

  it("filters by setting and sorts by name or setting from the headings", async () => {
    const setting = (id: number, slug: string, name: string) => ({
      id,
      slug,
      name,
      grade: "1a",
      grade_label: "Official",
      sort_order: id,
      always_on: id === 1,
      warband_types: 0,
    });
    fakeApi.on("GET /settings/", {
      settings: [
        setting(1, "mordheim", "Mordheim 1a"),
        { ...setting(6, "lustria", "Lustria"), grade: "1b" },
      ],
      presets: [],
    });
    const lizardmen = {
      ...MERCENARIES,
      id: 2,
      name: "Lizardmen",
      slug: "lizardmen",
      setting_id: 6,
      types: [{ ...type(20, "Lizardmen", ""), setting_id: 6 }],
    };
    fakeApi.on(`GET /warband-templates/?campaign_id=${CAMPAIGN_ID}`, [MERCENARIES, lizardmen]);
    const user = setupUser();
    const app = renderApp(PAGE);

    expect(await row("Lizardmen")).toHaveTextContent("LizardmenLustria");
    expect(rowNames()).toEqual(["Lizardmen", "Middenheimers", "Reiklanders"]);

    await user.click(screen.getByRole("button", { name: "Sort by Setting" }));
    expect(rowNames()).toEqual(["Middenheimers", "Reiklanders", "Lizardmen"]);
    expect(param(app, "sort")).toBe("setting");
    await user.click(screen.getByRole("button", { name: "Sort by Setting" }));
    expect(rowNames()).toEqual(["Lizardmen", "Reiklanders", "Middenheimers"]);
    await user.click(screen.getByRole("button", { name: "Sort by Warband" }));
    expect(rowNames()).toEqual(["Lizardmen", "Middenheimers", "Reiklanders"]);
    // William, 8 Nov 2026: "on warbands table can we also show grade"
    expect(await row("Lizardmen")).toHaveTextContent("LizardmenLustria1b");
    expect(await row("Reiklanders")).toHaveTextContent("ReiklandersMercenariesMordheim–");
    await user.click(screen.getByRole("button", { name: "Sort by Grade" }));
    expect(rowNames()).toEqual(["Lizardmen", "Middenheimers", "Reiklanders"]); // none last
    expect(param(app, "sort")).toBe("grade");
    await user.click(screen.getByRole("button", { name: "Sort by Grade" }));
    expect(rowNames()).toEqual(["Reiklanders", "Middenheimers", "Lizardmen"]);
    await user.click(screen.getByRole("button", { name: "Sort by Warband" }));

    const settings = screen.getByRole("group", { name: "Setting" });
    await user.click(within(settings).getByRole("button", { name: "Lustria" }));
    expect(rowNames()).toEqual(["Lizardmen"]);
    expect(screen.getByText("1 warband type")).toBeInTheDocument();
    await user.click(within(settings).getByRole("button", { name: "Mordheim" }));
    expect(rowNames()).toEqual(["Middenheimers", "Reiklanders"]);
  });

  it("opens to the template in its type's variant, and the switch shows another's", async () => {
    const user = setupUser();
    renderApp(PAGE);
    await user.click(await row("Middenheimers"));

    expect(await screen.findByRole("article", { name: "Champion" })).toHaveTextContent(
      "35 gc · 0–2"
    );
    expect(tags("Skills")).toBe("SkillsCombatStrengthSpeed");
    // the skills he starts with, his own then his variant's, each opened to read (William, 7 Nov 2026)
    const champion = within(screen.getByRole("article", { name: "Champion" }));
    const starts = champion.getByText("Starts with: Hunter, Ride [Animal]").closest("details");
    expect(starts).toHaveTextContent("HunterFires each turn.Ride [Animal]Rides the animal.");
    expect(screen.getByRole("button", { name: "Middenheim" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Middenheimer Special rules" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reiklander Special rules" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reiklander drill" })).toBeNull(); // the Reiklanders' own

    await user.click(screen.getByRole("button", { name: "Reikland" }));
    expect(tags("Skills")).toBe("SkillsCombatShootingStrength");
    expect(champion.getByText("Starts with: Hunter")).toBeInTheDocument();
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

describe("Making and editing templates on the Warbands page", () => {
  const warbandType = (id: number, name: string, in_play = true) => ({
    id,
    name,
    slug: name.toLowerCase(),
    campaign_id: null,
    setting: null,
    source: "",
    link_url: "",
    groups: [],
    race: "",
    source_code: "",
    broheim_grade: "",
    mordheimer_grade: "",
    in_play,
  });

  it("lists a type in play with no template, which opens to Make a template", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/warband-types/`, [
      warbandType(10, "Reiklanders"),
      warbandType(20, "Lizardmen (2b)"),
      warbandType(21, "Khemri Raiders", false),
    ]);
    const user = setupUser();
    renderApp(PAGE);
    const lizardmen = await row("Lizardmen (2b)");
    expect(lizardmen).toHaveTextContent("Lizardmen (2b)No templateMordheim");
    expect(
      screen.queryByRole("button", { name: (label) => label.startsWith("Khemri") })
    ).toBeNull();
    await user.click(lizardmen);
    await user.click(screen.getByRole("button", { name: "Make a template for Lizardmen (2b)" }));
    const dialog = await screen.findByRole("dialog", { name: "Make a template" });
    const name = within(dialog).getByRole("textbox");
    expect(name).toHaveValue("Lizardmen (2b)");
    expect(document.querySelector(`label[for="${name.id}"]`)).toHaveTextContent("Name");
  });

  it("makes a copy for the type, which the editor opens on", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/warband-types/`, [warbandType(20, "Lizardmen (2b)")]);
    const copy = { ...MERCENARIES, id: 8, campaign_id: CAMPAIGN_ID, name: "Lizardmen (2b)" };
    fakeApi.on("POST /warband-templates/", () => ({
      template: copy,
      facts: { source: "custom", copied_from: { id: 1, name: "Mercenaries" }, warbands: 0 },
      warnings: [],
    }));
    const user = setupUser();
    renderApp(PAGE);
    await user.click(await row("Lizardmen (2b)"));
    await user.click(screen.getByRole("button", { name: "Make a template for Lizardmen (2b)" }));
    const dialog = await screen.findByRole("dialog", { name: "Make a template" });
    await user.click(within(dialog).getByRole("button", { name: "Copy a template" }));
    await user.click(within(dialog).getByRole("combobox", { name: "Copy of" }));
    await user.click(await within(dialog).findByRole("option", { name: /^Mercenaries/ }));
    await user.click(within(dialog).getByRole("button", { name: "Make the template" }));

    expect(
      await screen.findByText("Custom · copied from Mercenaries · used by 0 warbands")
    ).toBeInTheDocument();
    expect(fakeApi.bodyOf("POST /warband-templates/")).toEqual({
      campaign_id: CAMPAIGN_ID,
      name: "Lizardmen (2b)",
      copy_of: 1,
      type_ids: [20],
    });
  });

  it("opens a template in the editor from Edit template", async () => {
    fakeApi.on(`GET /warband-templates/1/editor/?campaign_id=${CAMPAIGN_ID}`, {
      template: MERCENARIES,
      facts: { source: "book", copied_from: null, warbands: 3 },
      warnings: [],
    });
    const user = setupUser();
    renderApp(PAGE);
    await user.click(await row("Reiklanders"));
    await user.click(await screen.findByRole("button", { name: "Edit template" }));
    expect(await screen.findByText("The book's · used by 3 warbands")).toBeInTheDocument();
  });
});
