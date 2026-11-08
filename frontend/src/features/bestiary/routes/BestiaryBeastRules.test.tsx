/**
 * A beast's own rules stay on the beast (William, 7 Nov 2026: "keep bestiary rules from displaying
 * on the boons and banes page, show on beast for sure"): its open row lists a rule only beasts
 * hold (owner kind beast) beside the general ones.
 */
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BestiaryEntry } from "@/features/bestiary/types/bestiary-types";
import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { bestiaryEntry } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/bestiary/routes/Bestiary";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const giant = bestiaryEntry({ id: 9, name: "Giant", large: true });
const detail: BestiaryEntry = {
  ...giant,
  skills: [],
  specials: [
    {
      id: 41,
      name: "Attacks (Giant)",
      type: "Animal",
      owner_kind: "beast",
      description: "Grab-it!",
    },
    {
      id: 42,
      name: "Fear",
      type: "Psychology",
      owner_kind: "general",
      description: "Causes fear.",
    },
  ],
  spells: [],
  equipment: [],
};

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignSummary());
  fakeApi.on(`GET /bestiary/?campaign_id=${CAMPAIGN_ID}`, [giant]);
  fakeApi.on(`GET /bestiary/${giant.id}/`, detail);
});

afterEach(() => {
  cleanupApps();
  vi.restoreAllMocks();
});

describe("A beast's own rules", () => {
  it("show in its open row", async () => {
    const user = setupUser();
    renderApp(`/campaigns/${CAMPAIGN_ID}/bestiary`);

    await user.click(
      await screen.findByRole("button", { name: (label) => label.startsWith("Giant") })
    );

    expect(await screen.findByText("Attacks (Giant)")).toBeInTheDocument();
    expect(screen.getByText("Grab-it!")).toBeInTheDocument();
    expect(screen.getByText("Fear")).toBeInTheDocument();
  });
});
