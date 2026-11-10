/**
 * The warband page's hire drawer (William, 7 Nov 2026: "adding a hired sword on warband page
 * should open a side draw (add new button there opens the hired sword modal)"; "should also be a
 * toggle to see all not just allowed"): who the warband may hire, Show all for the rest with the
 * server's reason (still hired), the dramatis personae beside them, Add new and the hire itself.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WhoCan } from "@/features/items/types/item-types";
import { catalogueListKey } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { hiredSword } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import { blankFee } from "../../fees";
import HireDrawer from "./HireDrawer";

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

const WARBAND = 30;
const ogre = hiredSword({ id: 17, name: "Ogre Bodyguard" });
const ratOgre = hiredSword({
  id: 18,
  name: "Clan Skryre Rat Ogre",
  hire_fee: { ...blankFee(), gold: 100 },
});
const bertha = hiredSword({ id: 60, name: "Bertha Bestraufrung" });
const whoCan: WhoCan = {
  items: [],
  hired_swords: [
    { id: 17, can_hire: true, reason: "" },
    { id: 18, can_hire: false, reason: "Not usually available to Reiklanders." },
  ],
  dramatis_personae: [{ id: 60, can_hire: true, reason: "" }],
  skill_group_ids: [],
  special_skill_ids: [],
} as WhoCan;

function renderDrawer({ canHire = true } = {}) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.campaign.detail(CAMPAIGN_ID), campaignSummary());
  queryClient.setQueryData(catalogueListKey(CAMPAIGN_ID, "hired-swords"), [ogre, ratOgre]);
  queryClient.setQueryData(catalogueListKey(CAMPAIGN_ID, "dramatis-personae"), [bertha]);
  queryClient.setQueryData(queryKeys.campaign.warbandWhoCan(CAMPAIGN_ID, WARBAND), whoCan);
  const onHired = vi.fn();
  renderWithQueryClient(
    <HireDrawer
      campaignId={CAMPAIGN_ID}
      warband={{
        id: WARBAND,
        name: "Reikland Rangers",
        resources: [],
        hero_count: 2,
        max_heroes: 6,
      }}
      heroes={[]}
      canHire={canHire}
      open
      onOpenChange={vi.fn()}
      onHired={onHired}
    />,
    { queryClient }
  );
  return { onHired };
}

const names = (list: string) =>
  within(screen.getByRole("list", { name: list }))
    .queryAllByRole("listitem")
    .map((row) => row.querySelector("span")?.textContent);

beforeEach(() => fakeApi.reset());

describe("HireDrawer", () => {
  it("lists who the warband may hire, and Show all the rest with the reason", async () => {
    const user = setupUser();
    renderDrawer();
    expect(names("Hired Swords")).toEqual(["Ogre Bodyguard"]);

    await user.click(screen.getByRole("switch", { name: "Show all" }));
    expect(names("Hired Swords")).toEqual(["Ogre Bodyguard", "Clan Skryre Rat Ogre"]);
    expect(screen.getByText("Not usually available to Reiklanders.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dramatis Personae" }));
    expect(names("Dramatis Personae")).toEqual(["Bertha Bestraufrung"]);
  });

  it("hires one it can't usually hire, with the warning, and hands back the new unit", async () => {
    const user = setupUser();
    fakeApi.on(`POST /warbands/${WARBAND}/hirelings/hire/`, { id: 77, name: "" });
    const { onHired } = renderDrawer();
    await user.click(screen.getByRole("switch", { name: "Show all" }));
    await user.click(screen.getByRole("button", { name: "Hire Clan Skryre Rat Ogre" }));

    const dialog = await screen.findByRole("dialog", { name: "Clan Skryre Rat Ogre" });
    expect(within(dialog).getByText("Not usually available to Reiklanders.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Hire for 100 gc" }));

    await waitFor(() => expect(onHired).toHaveBeenCalledWith(77));
    expect(fakeApi.bodyOf(`POST /warbands/${WARBAND}/hirelings/hire/`)).toMatchObject({
      source: "hired_sword",
      id: 18,
      price: 100,
    });
  });

  // William, 8 Nov 2026: "we dont need the Hire someone not on this list button or inline form"
  it("opens the hired sword form from Add new, and types nobody in by hand", async () => {
    const user = setupUser();
    renderDrawer();
    expect(screen.queryByRole("button", { name: /not in the list/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add new" }));
    expect(await screen.findByRole("dialog", { name: "Add hired sword" })).toBeInTheDocument();
  });

  it("only reads the list for a viewer who can't hire for the warband", () => {
    renderDrawer({ canHire: false });
    expect(screen.queryByRole("button", { name: "Hire Ogre Bodyguard" })).not.toBeInTheDocument();
  });
});
