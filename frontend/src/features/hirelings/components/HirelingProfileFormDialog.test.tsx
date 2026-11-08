/**
 * The hired sword and dramatis persona form (William, 7 Nov 2026): its parts in order, the race
 * a dropdown with Add new (a name and its maximum profile, made a campaign race and picked), the
 * hire fee and upkeep (gold, dice and one resource), no upkeep for one who takes a hero's place,
 * the skill groups as tick boxes, and a stored fee the form can't hold left out of the write.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogueListKey } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";
import { CAMPAIGN_ID } from "@/test/campaign-fixtures";
import { hiredSword } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import { blankFee } from "../fees";
import { DRAMATIS_PERSONAE, HIRED_SWORDS } from "../hireling-catalogue-kinds";
import type { HirelingProfileDetail } from "../types/hireling-catalogue-types";
import HirelingProfileFormDialog from "./HirelingProfileFormDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/features/warbands/api/warband-types-queries", () => ({
  useWarbandTypes: () => ({ data: [] }),
}));
vi.mock("@/features/items/api/who-can-queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/items/api/who-can-queries")>()),
  useWarbandGroups: () => ({ data: [] }),
}));

const HUMAN = {
  id: 1,
  campaign_id: null,
  name: "Human",
  movement: 4,
  weapon_skill: 6,
  ballistic_skill: 6,
  strength: 4,
  toughness: 4,
  wounds: 3,
  initiative: 6,
  attacks: 4,
  leadership: 9,
};
const RESOURCES = [{ name: "Wyrdstone", is_default: true, is_campaign_points: false }];

const detail = (overrides: Partial<HirelingProfileDetail> = {}): HirelingProfileDetail => ({
  ...hiredSword({ id: 17, campaign_id: CAMPAIGN_ID, ...overrides }),
  skills: [],
  specials: [],
  spells: [],
  equipment: [],
  ...overrides,
});

function renderForm(editing: HirelingProfileDetail | null = null, config = HIRED_SWORDS) {
  const queryClient = createTestQueryClient();
  for (const kind of ["races", "skills", "specials", "spells", "items"] as const) {
    queryClient.setQueryData(catalogueListKey(CAMPAIGN_ID, kind), kind === "races" ? [HUMAN] : []);
  }
  queryClient.setQueryData(catalogueListKey(CAMPAIGN_ID, config.kind), editing ? [editing] : []);
  queryClient.setQueryData(queryKeys.campaign.resources(CAMPAIGN_ID), RESOURCES);
  if (editing) {
    queryClient.setQueryData(
      queryKeys.campaign.catalogueEntry(CAMPAIGN_ID, config.kind, editing.id),
      editing
    );
  }
  renderWithQueryClient(
    <HirelingProfileFormDialog
      config={config}
      campaignId={CAMPAIGN_ID}
      open
      onOpenChange={vi.fn()}
      editingId={editing?.id ?? null}
      canDelete={false}
    />,
    { queryClient }
  );
  return screen.getByRole("dialog");
}

beforeEach(() => fakeApi.reset());

describe("The hired sword form", () => {
  it("sets its fields out in parts, in order", () => {
    const form = renderForm();
    const parts = within(form)
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-label"));
    expect(parts).toEqual([
      "Who",
      "Profile",
      "Hire fee and upkeep",
      "Skills and caster",
      "Rules",
      "Wargear",
      "Who can hire",
      "Description",
    ]);
    expect(within(form).queryByText("Race label")).not.toBeInTheDocument();
    const groups = within(form).getByRole("group", { name: "Skill groups" });
    expect(within(groups).getAllByRole("checkbox").length).toBeGreaterThan(4);
    expect(within(form).getByRole("group", { name: "Caster" })).toBeInTheDocument();
  });

  it("adds a race with its maximum profile, and saves a fee with a resource and an upkeep", async () => {
    const user = setupUser();
    fakeApi.on("POST /races/", (body: object) => ({ ...HUMAN, ...body, id: 9 }));
    fakeApi.on("POST /hired-swords/", (body: object) => detail({ id: 50, ...body }));
    const form = renderForm();

    await user.type(within(form).getByRole("textbox", { name: "Name" }), "Tilean Duellist");
    await user.click(within(form).getByRole("button", { name: "Add new" }));
    const race = within(form).getByRole("group", { name: "New race" });
    await user.type(within(race).getByRole("textbox", { name: "Race name" }), "Tilean");
    await user.clear(within(race).getByRole("textbox", { name: "WS maximum" }));
    await user.type(within(race).getByRole("textbox", { name: "WS maximum" }), "7");
    await user.click(within(race).getByRole("button", { name: "Add race" }));
    await waitFor(() => expect(fakeApi.bodyOf("POST /races/")).toMatchObject({ name: "Tilean" }));
    expect(fakeApi.bodyOf("POST /races/")).toMatchObject({
      weapon_skill: 7,
      campaign_id: CAMPAIGN_ID,
    });
    expect(await within(form).findByRole("button", { name: "Race: Tilean" })).toBeInTheDocument();

    await user.type(within(form).getByRole("spinbutton", { name: "Hire fee gold" }), "30");
    await user.type(within(form).getByRole("textbox", { name: "Hire fee dice: how many D6" }), "1");
    await user.click(within(form).getAllByRole("button", { name: "Add resource" })[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Wyrdstone" }));
    expect(within(form).getByText("30 + D6 gc and 1 Wyrdstone")).toBeInTheDocument();
    await user.type(within(form).getByRole("spinbutton", { name: "Upkeep gold" }), "15");
    await user.click(within(form).getByRole("button", { name: "Create" }));

    await waitFor(() => expect(fakeApi.bodyOf("POST /hired-swords/")).toBeDefined());
    expect(fakeApi.bodyOf("POST /hired-swords/")).toMatchObject({
      name: "Tilean Duellist",
      race_id: 9,
      race_label: "Tilean",
      hire_fee: {
        kind: "gold",
        gold: 30,
        dice: 1,
        resources: [{ resource: "Wyrdstone", amount: 1 }],
      },
      upkeep_fee: { kind: "gold", gold: 15, resources: [] },
    });
  });

  it("drops the upkeep for one who takes a hero's place", async () => {
    const user = setupUser();
    fakeApi.on("POST /hired-swords/", (body: object) => detail({ id: 51, ...body }));
    const form = renderForm();
    await user.type(within(form).getByRole("textbox", { name: "Name" }), "Priest");
    await user.selectOptions(
      within(form).getByRole("combobox", { name: "Hire fee kind" }),
      "replaces_hero"
    );

    expect(within(form).queryByRole("group", { name: "Upkeep" })).not.toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: "Create" }));
    await waitFor(() => expect(fakeApi.bodyOf("POST /hired-swords/")).toBeDefined());
    expect(fakeApi.bodyOf("POST /hired-swords/")).toMatchObject({
      hire_fee: { kind: "replaces_hero" },
      upkeep_fee: { kind: "none" },
    });
  });

  it("leaves a stored fee with several resources out of the write, so it is kept", async () => {
    const user = setupUser();
    const entry = detail({
      hire_fee: {
        ...blankFee(),
        gold: 20,
        resources: [
          { resource: "Treasure", amount: 2 },
          { resource: "Wyrdstone", amount: 1 },
        ],
      },
    });
    fakeApi.on("PATCH /hired-swords/17/", (body: object) => ({ ...entry, ...body }));
    const form = renderForm(entry);
    expect(within(form).getByText("20 gc + 2 Treasure + 1 Wyrdstone")).toBeInTheDocument();

    await user.click(within(form).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fakeApi.bodyOf("PATCH /hired-swords/17/")).toBeDefined());
    const body = fakeApi.bodyOf("PATCH /hired-swords/17/") as Record<string, unknown>;
    expect(body).not.toHaveProperty("hire_fee");
    expect(body.upkeep_fee).toMatchObject({ kind: "gold", gold: 30 });
  });

  it("is the dramatis persona form too, with how long he stays and what he is paid in", () => {
    const form = renderForm(null, DRAMATIS_PERSONAE);
    const terms = within(form).getByRole("region", { name: "Hire fee and upkeep" });
    expect(within(terms).getByText("Stays")).toBeInTheDocument();
    expect(within(terms).getByRole("textbox", { name: "Paid in" })).toBeInTheDocument();
  });
});
