/**
 * The phone's bottom nav on the real routes over the fake API server: the Me sheet (the
 * campaign's settings and your account, nothing of the warband's).
 */
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/rules/routes/HouseRules";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));

const BASE = `/campaigns/${CAMPAIGN_ID}`;
const bottomNav = () => screen.findByRole("navigation", { name: "Main" });

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
});

afterEach(() => {
  cleanupApps();
});

describe("the Me sheet", () => {
  it("lists only Settings and Account, even with the Encampment and Locations on, and Account opens in the campaign", async () => {
    fakeApi.on(
      `GET ${BASE}/`,
      campaignSummary({ enable_encampments: true, enable_locations: true })
    );
    const user = setupUser();
    const app = renderApp(`${BASE}/house-rules`);

    await user.click(within(await bottomNav()).getByRole("button", { name: "Me" }));

    const sheet = await screen.findByRole("dialog", { name: "Me" });
    expect(
      within(sheet)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["Settings", "Account"]);
    expect(within(sheet).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      `${BASE}/settings`
    );

    await user.click(within(sheet).getByRole("link", { name: "Account" }));

    expect(app.location().pathname).toBe(`${BASE}/account`);
    expect(await screen.findAllByRole("heading", { name: "Account", level: 1 })).not.toHaveLength(
      0
    );
    expect(within(await bottomNav()).getByRole("button", { name: "Me" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
