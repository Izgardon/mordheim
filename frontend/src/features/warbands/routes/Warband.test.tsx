/**
 * The warband page's workshop parts (apps/workshop): my own warband in a campaign offers Copy to
 * my workshop, which opens the copy there; a workshop's warband shows its code and offers none.
 */
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

import "@/features/campaigns/routes/CampaignLayout";
import "@/features/workshop/routes/WorkshopLayout";
import "./Warband";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const WORKSHOP_ID = 90;

const sheet = (id: number, campaignId: number, workshop: boolean) => ({
  warband: {
    id,
    name: "Iron Vultures",
    campaign_id: campaignId,
    user_id: RAIDER.id,
    warband_type: { id: 3, name: "Reiklanders" },
  },
  summary: {
    gold: 120,
    rating: 0,
    resources: [],
    workshop: workshop ? { cost: 380, budget: 500 } : null,
  },
  capabilities: { edit: true, manage_items: true, workshop, trade: false },
  rules: [],
  heroes: [],
  henchmen_groups: [],
  hirelings: [],
  workshop: workshop ? { cost: 380, budget: 500, share_code: "VLTR2345" } : null,
});

const openMenu = async (user: ReturnType<typeof setupUser>) =>
  user.click(await screen.findByRole("button", { name: "More warband actions" }));

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignSummary());
  fakeApi.on(
    `GET /campaigns/${WORKSHOP_ID}/`,
    campaignSummary({ id: WORKSHOP_ID, kind: "workshop", name: "Workshop" })
  );
  fakeApi.on("GET /warbands/9/sheet/", sheet(9, CAMPAIGN_ID, false));
  fakeApi.on("GET /warbands/41/sheet/", sheet(41, WORKSHOP_ID, true));
});

afterEach(() => {
  cleanupApps();
});

describe("the warband page and the workshop", () => {
  it("copies my own campaign warband into my workshop and opens the copy there", async () => {
    fakeApi.on("POST /warbands/9/to-workshop/", {
      id: 41,
      campaign_id: WORKSHOP_ID,
      name: "Iron Vultures",
      warband_type: { id: 3, name: "Reiklanders" },
      template_id: 5,
      cost: 380,
      budget: 500,
      share_code: "VLTR2345",
      updated_at: "2026-11-26T10:00:00Z",
      kind: "warband",
      warnings: [],
    });
    const user = setupUser();
    const app = renderApp(`/campaigns/${CAMPAIGN_ID}/warbands/9`);

    await openMenu(user);
    await user.click(await screen.findByRole("menuitem", { name: "Copy to my workshop" }));

    await waitFor(() =>
      expect(app.location().pathname).toBe(`/workshop/${WORKSHOP_ID}/warbands/41`)
    );
    expect(await screen.findByText("VLTR2345")).toBeInTheDocument();
  });

  it("shows a workshop warband with its code, and offers no copy of it", async () => {
    const user = setupUser();
    renderApp(`/workshop/${WORKSHOP_ID}/warbands/41`);

    expect(await screen.findByText("VLTR2345")).toBeInTheDocument();
    await openMenu(user);
    expect(await screen.findByRole("menuitem", { name: "Rating breakdown" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Copy to my workshop" })).toBeNull();
  });
});
