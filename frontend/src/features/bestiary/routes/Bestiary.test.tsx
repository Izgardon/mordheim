/**
 * A beast's rating on the Bestiary page (William, 7 Nov 2026: "bestiary creatures need rating ...
 * Just add field for now"), on the real routes over the fake API server: its row and its open row
 * name it when it has one, and the form's Rating field sends it, a blank one as none.
 */
import { screen, within } from "@testing-library/react";
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

const PAGE = `/campaigns/${CAMPAIGN_ID}/bestiary`;
const ogre = bestiaryEntry({ id: 7, name: "Dragon Ogre", rating: 40, large: true });
const warhound = bestiaryEntry();
const detail = (summary: typeof ogre): BestiaryEntry => ({
  ...summary,
  skills: [],
  specials: [],
  spells: [],
  equipment: [],
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
  fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignSummary());
  fakeApi.on(`GET /bestiary/?campaign_id=${CAMPAIGN_ID}`, [ogre, warhound]);
  fakeApi.on(`GET /bestiary/${ogre.id}/`, detail(ogre));
});

afterEach(() => {
  cleanupApps();
  vi.restoreAllMocks();
});

describe("A beast's rating", () => {
  it("shows in its row and its open row when it has one", async () => {
    const user = setupUser();
    renderApp(PAGE);

    expect(await row("Dragon Ogre")).toHaveTextContent("Creature · Large · Rating 40");
    expect(await row("Warhound")).not.toHaveTextContent("Rating");

    await user.click(await row("Dragon Ogre"));
    expect(await screen.findByRole("heading", { name: "Dragon Ogre", level: 2 })).toBeVisible();
    expect(screen.getAllByText("Creature · Large · Rating 40")).toHaveLength(2);
  });

  it("is the form's Rating field: sent as a whole number, a blank one as none", async () => {
    fakeApi.on("POST /bestiary/", (body: object) => ({ ...detail(warhound), id: 30, ...body }));
    fakeApi.on(`GET /bestiary/${warhound.id}/`, detail(warhound));
    fakeApi.on(`PATCH /bestiary/${ogre.id}/`, (body: object) => ({ ...detail(ogre), ...body }));
    const user = setupUser();
    renderApp(PAGE);
    await row("Dragon Ogre");

    await user.click(screen.getByRole("button", { name: "Add beast" }));
    const adding = await screen.findByRole("dialog", { name: "Add bestiary entry" });
    await user.type(within(adding).getByRole("textbox", { name: /Name/ }), "Ymir");
    await user.type(within(adding).getByRole("spinbutton", { name: "Rating" }), "35");
    await user.click(within(adding).getByRole("button", { name: "Create" }));
    expect(fakeApi.bodyOf("POST /bestiary/")).toMatchObject({ name: "Ymir", rating: 35 });

    await user.click(await row("Dragon Ogre"));
    await user.click(await screen.findByRole("button", { name: "Edit entry" }));
    const editing = await screen.findByRole("dialog", { name: "Edit bestiary entry" });
    const rating = within(editing).getByRole("spinbutton", { name: "Rating" });
    expect(rating).toHaveValue(40);
    await user.clear(rating);
    await user.click(within(editing).getByRole("button", { name: "Save changes" }));
    expect(fakeApi.bodyOf(`PATCH /bestiary/${ogre.id}/`)).toMatchObject({ rating: null });
  });
});
