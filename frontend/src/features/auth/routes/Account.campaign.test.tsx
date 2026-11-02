/**
 * The account page opened from inside a campaign (`/campaigns/:id/account`), on the real routes
 * over the fake API server: it sits in the campaign's shell, so the rail (web) or the bottom nav
 * (phone) stays, with the same sections as `/account`.
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

const media = vi.hoisted(() => ({ mobile: false }));

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => media.mobile }));

const BASE = `/campaigns/${CAMPAIGN_ID}`;
const SECTIONS = ["Display name", "Password", "Sign out everywhere else", "Delete account"];

/** The page's own heading (a phone's top bar carries a second "Account"). */
const accountPage = () => screen.findAllByRole("heading", { name: "Account", level: 1 });

beforeEach(() => {
  media.mobile = false;
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET ${BASE}/`, campaignSummary());
});

afterEach(() => {
  cleanupApps();
});

describe("Account inside a campaign, on the web", () => {
  it("is the rail's account row, which opens it in the campaign's shell", async () => {
    const user = setupUser();
    const app = renderApp(`${BASE}/house-rules`);
    const rail = await screen.findByRole("navigation", { name: "Campaign" });

    await user.click(within(rail).getByRole("link", { name: RAIDER.name }));

    await accountPage();
    expect(app.location().pathname).toBe(`${BASE}/account`);
    const row = within(screen.getByRole("navigation", { name: "Campaign" })).getByRole("link", {
      name: RAIDER.name,
    });
    expect(row).toHaveAttribute("href", `${BASE}/account`);
    expect(row).toHaveAttribute("aria-current", "page");
    for (const name of SECTIONS) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.getByText(`Signed in as ${RAIDER.email}`)).toBeInTheDocument();
    // the campaigns list's bar is not there: this is the campaign's page
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
  });
});

describe("Account inside a campaign, on a phone", () => {
  beforeEach(() => {
    media.mobile = true;
  });

  it("keeps the bottom nav, Me current, and the top bar titles it", async () => {
    renderApp(`${BASE}/account`);
    await accountPage();

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("button", { name: "Me" })).toHaveAttribute("aria-current", "page");
    const topBar = screen.getByRole("group", { name: "Table tools" }).closest("header")!;
    expect(within(topBar).getByRole("heading", { level: 1 })).toHaveTextContent("Account");
    for (const name of SECTIONS) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });
});
