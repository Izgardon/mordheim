/**
 * The Hired swords reference page, opened for a warband (`?warband=`): it hires from a row, and
 * an entry added here is only saved, never hired (William, 8 Nov 2026: "when saving it should
 * automatically add that hired sword as if they had clicked hire, but only from that page", the
 * warband page's hire drawer), and nobody is typed in by hand.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WhoCan } from "@/features/items/types/item-types";
import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";
import { catalogueListKey } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { hiredSword } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";

import type { HirelingProfileDetail } from "../types/hireling-catalogue-types";
import HirelingCatalogue from "./HirelingCatalogue";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/warbands/api/warband-types-queries", () => ({
  useWarbandTypes: () => ({ data: [] }),
}));
vi.mock("@/features/items/api/who-can-queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/items/api/who-can-queries")>()),
  useWarbandGroups: () => ({ data: [] }),
}));

const WARBAND = 30;
const HIRE = `POST /warbands/${WARBAND}/hirelings/hire/`;
const ogre = hiredSword({ id: 17, name: "Ogre Bodyguard" });
const duellist: HirelingProfileDetail = {
  ...hiredSword({ id: 90, campaign_id: CAMPAIGN_ID, name: "Tilean Duellist" }),
  skills: [],
  specials: [],
  spells: [],
  equipment: [],
};
const sheet = {
  warband: { id: WARBAND, name: "Reikland Rangers", resources: [] },
  summary: {},
  capabilities: { edit: true },
  rules: [],
  heroes: [],
  henchmen_groups: [],
  hirelings: [],
} as unknown as WarbandSheet;
const whoCan = {
  items: [],
  hired_swords: [{ id: 17, can_hire: true, reason: "" }],
  dramatis_personae: [],
  skill_group_ids: [],
  special_skill_ids: [],
  materials: [],
} as WhoCan;

function renderPage(entries = [ogre]) {
  const queryClient = createTestQueryClient();
  for (const kind of ["races", "skills", "specials", "spells", "items"] as const) {
    queryClient.setQueryData(catalogueListKey(CAMPAIGN_ID, kind), []);
  }
  queryClient.setQueryData(queryKeys.campaign.resources(CAMPAIGN_ID), []);
  queryClient.setQueryData(catalogueListKey(CAMPAIGN_ID, "hired-swords"), entries);
  queryClient.setQueryData(queryKeys.campaign.warbandSheet(CAMPAIGN_ID, WARBAND), sheet);
  queryClient.setQueryData(queryKeys.campaign.warbandWhoCan(CAMPAIGN_ID, WARBAND), whoCan);
  renderWithQueryClient(
    <MemoryRouter initialEntries={[`/campaigns/${CAMPAIGN_ID}/hired-swords?warband=${WARBAND}`]}>
      <Routes>
        <Route path="/campaigns/:id" element={<Outlet context={{ campaign: campaignSummary() }} />}>
          <Route path="hired-swords" element={<HirelingCatalogue kind="hired-swords" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
    { queryClient }
  );
}

beforeEach(() => fakeApi.reset());

describe("Hired swords opened for a warband", () => {
  it("saves a hired sword added here without hiring him, and types nobody in by hand", async () => {
    const user = setupUser();
    fakeApi.on("POST /hired-swords/", duellist);
    renderPage();
    expect(await screen.findByText("Ogre Bodyguard")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /not in the list/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add new" }));
    const form = await screen.findByRole("dialog", { name: "Add hired sword" });
    await user.type(within(form).getByRole("textbox", { name: "Name" }), "Tilean Duellist");
    await user.click(within(form).getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Add hired sword" })).not.toBeInTheDocument()
    );
    expect(fakeApi.countOf("POST /hired-swords/")).toBe(1);
    // his row opens, with Hire there to press; nothing is hired
    expect(await screen.findByRole("button", { name: "Hire from here" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Tilean Duellist" })).not.toBeInTheDocument();
    expect(fakeApi.countOf(HIRE)).toBe(0);
  });

  it("filters by setting once the entries come from two, Mordheim's grades as one", async () => {
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
        setting(11, "mutiny-in-marienburg", "Mutiny in Marienburg"),
      ],
      presets: [],
    });
    const pirate = hiredSword({ id: 18, name: "Pirate Captain", setting_id: 11 });
    const user = setupUser();
    renderPage([ogre, pirate]);

    expect(await screen.findByText("Pirate Captain")).toBeInTheDocument();
    const filter = await screen.findByRole("combobox", { name: "Setting" });
    await pickOption(user, filter, "Mutiny in Marienburg");
    expect(screen.queryByText("Ogre Bodyguard")).not.toBeInTheDocument();
    expect(screen.getByText("Pirate Captain")).toBeInTheDocument();
    await pickOption(user, filter, "Mordheim");
    expect(screen.getByText("Ogre Bodyguard")).toBeInTheDocument();
    expect(screen.queryByText("Pirate Captain")).not.toBeInTheDocument();
  });
});
