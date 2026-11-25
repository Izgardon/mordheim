/**
 * A workshop's page (apps/workshop): its list on its own in Home's frame, with its code and Edit
 * list, no campaign shell; and a workshop never opens as a campaign.
 */
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
// The routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "./WorkshopLayout";
import "./WorkshopPage";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const WORKSHOP = campaignSummary({
  id: 13,
  name: "Night Watch",
  kind: "workshop",
  holds: "list",
  share_code: "WTCH2345",
  join_code: "",
  capabilities: { edit_catalogue: true },
});

const TEMPLATE = {
  id: 90,
  campaign_id: 13,
  setting_id: null,
  name: "Night Watch",
  slug: "night-watch",
  starting_gold: 500,
  gold: 500,
  max_models: 15,
  most_warriors: 15,
  variants: [],
  source: "",
  link_url: "",
  in_play: true,
  types: [
    {
      id: 10,
      name: "Reiklanders",
      slug: "reiklanders",
      source_code: "",
      setting_id: null,
      campaign_id: null,
      variant: "",
      archived: false,
      in_play: true,
    },
  ],
  rules: [{ id: 1, title: "Watchmen", description: "Alert.", variant: "", warband_type_id: null }],
  lists: [],
  upgrades: [],
  fighters: [],
};

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on("GET /campaigns/13/", WORKSHOP);
  fakeApi.on("GET /workshop/", {
    warbands: [],
    lists: [
      {
        id: 13,
        campaign_id: 13,
        template_id: 90,
        name: "Night Watch",
        warband_types: [{ id: 10, name: "Reiklanders" }],
        share_code: "WTCH2345",
        updated_at: "2026-11-25T10:00:00Z",
      },
    ],
  });
  fakeApi.on("GET /warband-templates/90/", TEMPLATE);
});

afterEach(() => {
  cleanupApps();
});

describe("a workshop's page", () => {
  it("shows a list on its own, with its code and Edit list, and the way back Home", async () => {
    renderApp("/workshop/13");

    const heading = await screen.findByRole("heading", { name: "Night Watch", level: 1 });
    const header = heading.closest("header") as HTMLElement;
    expect(header).toHaveTextContent("Warband list · Reiklanders");
    expect(within(header).getByText("WTCH2345")).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Edit list" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Watchmen" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Home" })[0]).toHaveAttribute("href", "/campaigns");
    // no campaign shell: no rail, no battles
    expect(screen.queryByRole("navigation", { name: "Campaign" })).toBeNull();
    expect(screen.queryByText("Battles")).toBeNull();
  });

  it("never opens as a campaign: its campaign page goes to the workshop's", async () => {
    const app = renderApp("/campaigns/13/battles");

    await screen.findByRole("heading", { name: "Night Watch", level: 1 });
    expect(app.location().pathname).toBe("/workshop/13");
  });
});
