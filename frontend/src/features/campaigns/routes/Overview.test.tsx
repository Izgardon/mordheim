/**
 * The overview's Start battle and Report a result, on the real routes over the fake API server:
 * they open the one dialog the campaign layout holds, with the campaign's players to pick from.
 */
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignPlayer } from "@/features/campaigns/types/campaign-types";
import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/campaigns/routes/Overview";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const BASE = `/campaigns/${CAMPAIGN_ID}`;

const player = (id: number, name: string, warband: string): CampaignPlayer => ({
  id,
  name,
  warband: { id: id + 100, name: warband, type_name: "Reiklanders", wins: 0, losses: 0 },
});
const PLAYERS = [player(RAIDER.id, "Raider", "Iron Vultures"), player(9, "Mira", "Night Razors")];

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET ${BASE}/`, campaignSummary());
  fakeApi.on(`GET ${BASE}/players/`, PLAYERS);
  fakeApi.on(`GET ${BASE}/battle-history/`, []);
  fakeApi.on(`GET ${BASE}/battles/?open=1`, []);
});

afterEach(() => {
  cleanupApps();
});

describe("the overview's battle buttons", () => {
  it("Start battle opens Start a battle, the campaign's players listed", async () => {
    const user = setupUser();
    renderApp(BASE);

    await user.click(await screen.findByRole("button", { name: "Start battle" }));

    const dialog = await screen.findByRole("dialog", { name: "Start a battle" });
    expect(within(dialog).getByText("You · Iron Vultures")).toBeInTheDocument();
    expect(within(dialog).getByText("Mira · Night Razors")).toBeInTheDocument();
  });

  it("Report a result opens Report a result", async () => {
    const user = setupUser();
    renderApp(BASE);

    await user.click(await screen.findByRole("button", { name: "Report a result" }));

    expect(await screen.findByRole("dialog", { name: "Report a result" })).toBeInTheDocument();
  });
});
