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
} as WhoCan;

function renderPage() {
  const queryClient = createTestQueryClient();
  for (const kind of ["races", "skills", "specials", "spells", "items"] as const) {
    queryClient.setQueryData(catalogueListKey(CAMPAIGN_ID, kind), []);
  }
  queryClient.setQueryData(queryKeys.campaign.resources(CAMPAIGN_ID), []);
  queryClient.setQueryData(catalogueListKey(CAMPAIGN_ID, "hired-swords"), [ogre]);
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

    await user.click(screen.getByRole("button", { name: "Add hired sword" }));
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
});
