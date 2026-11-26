/**
 * My workshop's catalogue pages (William, 26 Nov 2026: "New + edit own"): the book's entries are
 * read only there (no Edit, as the server's flags say), the player's own are edited, there is no
 * archive to show, and the campaign-only pages and links aren't there.
 */
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Special } from "@/features/special/types/special-types";
import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { spell } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

// The routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "./WorkshopLayout";
import "../components/WarbandsSection";
import "@/features/spells/routes/Spells";
import "@/features/special/routes/BoonsBanes";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const WORKSHOP_ID = 13;
// as the server reports a workshop's flags: its own catalogue only, no book edits, no archive
const WORKSHOP = campaignSummary({
  id: WORKSHOP_ID,
  name: "Workshop",
  kind: "workshop",
  join_code: "",
  capabilities: { edit_catalogue: true, delete_catalogue: true },
});
const LESSER = "Lesser Magic";
const bookSpell = spell({ id: 1, name: "Fires of U'Zhul", type: LESSER, roll: 1, dc: 7 });
const ownSpell = spell({
  id: 2,
  name: "Night Sight",
  type: LESSER,
  roll: 2,
  dc: 6,
  campaign_id: WORKSHOP_ID,
});
const special = (overrides: Partial<Special> & Pick<Special, "id" | "name">): Special => ({
  campaign_id: null,
  setting_id: null,
  type: "Psychology",
  kind: "trait",
  category: "aura",
  owner_kind: "general",
  description: "Causes fear.",
  cost: null,
  in_play: true,
  ...overrides,
});

const row = (name: string) =>
  screen.findByRole("button", { name: (label) => label.startsWith(name) });

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET /campaigns/${WORKSHOP_ID}/`, WORKSHOP);
  fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignSummary());
  fakeApi.on("GET /workshop/", { id: WORKSHOP_ID, warbands: [], lists: [] });
  fakeApi.on(`GET /spells/?campaign_id=${WORKSHOP_ID}`, [bookSpell, ownSpell]);
  fakeApi.on(`GET /spells/?campaign_id=${CAMPAIGN_ID}`, [bookSpell]);
  fakeApi.on(`GET /special/?campaign_id=${WORKSHOP_ID}`, [
    special({ id: 4, name: "Fear" }),
    special({ id: 5, name: "Night Eyes", type: "Ability", campaign_id: WORKSHOP_ID }),
  ]);
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanupApps();
  vi.restoreAllMocks();
});

describe("my workshop's catalogue", () => {
  it("edits my own spell, never a book one, and shows no archive", async () => {
    const user = setupUser();
    renderApp(`/workshop/${WORKSHOP_ID}/spells`);

    await user.click(await row(LESSER));
    await user.click(screen.getByRole("button", { name: "Fires of U'Zhul" }));
    expect(await screen.findByRole("button", { name: "Close rules" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit spell" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Night Sight" }));
    expect(await screen.findByRole("button", { name: "Edit spell" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Show archived" })).toBeNull();
  });

  it("keeps a campaign's archive and its book edits", async () => {
    const user = setupUser();
    renderApp(`/campaigns/${CAMPAIGN_ID}/spells`);

    await user.click(await row(LESSER));
    await user.click(screen.getByRole("button", { name: "Fires of U'Zhul" }));
    expect(await screen.findByRole("button", { name: "Edit spell" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Show archived" })).toBeInTheDocument();
  });

  it("edits my own special, not the book's Fear, and links no Rules page", async () => {
    const user = setupUser();
    renderApp(`/workshop/${WORKSHOP_ID}/boons-banes`);

    await user.click(await row("Fear"));
    expect(screen.queryByRole("link", { name: "Fear in the rules" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    await user.click(await row("Night Eyes"));
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("has no campaign-only page: a path to one goes to the workshop's warbands", async () => {
    for (const page of [
      "locations",
      "encampments",
      "scenarios",
      "rules",
      "house-rules",
      "battles",
    ]) {
      const app = renderApp(`/workshop/${WORKSHOP_ID}/${page}`);
      expect(await screen.findByRole("heading", { name: "Warbands" })).toBeInTheDocument();
      expect(app.location().pathname).toBe(`/workshop/${WORKSHOP_ID}`);
      cleanupApps();
    }
  });
});
