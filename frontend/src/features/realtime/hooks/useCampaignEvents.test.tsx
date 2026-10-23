/**
 * Live campaign changes (CAMP-NEW-07) as the app receives them (RealtimeProvider above the layout,
 * fake socket and server): `campaign.updated` on the campaign's events channel.
 */
import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PLAYER, campaignFor, patchedCampaign, routeCampaignShell } from "@/test/campaign-fixtures";
import { renderCampaignRoute } from "@/test/campaign-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { catalogueKindOf } from "./useCampaignEvents";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 9, email: "mira@example.com" }, signOut: () => undefined }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const EVENTS = "private-campaign-1-events";
const campaign = campaignFor("player", { chat_unread: 2 });

/** `campaign.updated`'s payload: the detail without the reader's own fields. */
const updated = (changes: Record<string, unknown>) => {
  const { role: _role, chat_unread: _unread, ...rest } = patchedCampaign(campaign, changes);
  return rest;
};

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell({ campaign, viewer: PLAYER });
});

async function openSkills() {
  const view = renderCampaignRoute("/campaigns/1/skills");
  expect(await screen.findByText("Skills page")).toBeInTheDocument();
  await waitFor(() => expect(fakeRealtime.subscriberCount(EVENTS, "campaign.updated")).toBe(1));
  return view;
}

describe("campaign.updated (CAMP-NEW-07)", () => {
  it("shows another member's change at once: a page switched on joins the rail", async () => {
    await openSkills();
    expect(screen.queryByRole("link", { name: "Encampments" })).toBeNull();
    // The server has the change: reading the campaign again gives it, with its new capabilities.
    fakeApi.on("GET /campaigns/1/", { ...campaign, ...updated({ enable_encampments: true }) });

    act(() => fakeRealtime.emit(EVENTS, "campaign.updated", updated({ enable_encampments: true })));

    expect(await screen.findByRole("link", { name: "Encampments" })).toBeInTheDocument();
    // A switched page changes what the reader may do there: the campaign is read for it.
    await waitFor(() => expect(fakeApi.countOf("GET /campaigns/1/")).toBe(2));
  });

  it("keeps the reader's own fields and reads nothing for a change that gates nothing", async () => {
    const { queryClient } = await openSkills();

    act(() => fakeRealtime.emit(EVENTS, "campaign.updated", updated({ in_progress: false })));

    expect(await screen.findByText("XP tracking: off")).toBeInTheDocument();
    expect(fakeApi.countOf("GET /campaigns/1/")).toBe(1);
    expect(queryClient.getQueryData(["campaign", 1, "detail"])).toMatchObject({
      in_progress: false,
      role: "player",
      chat_unread: 2,
      permissions: campaign.permissions,
      capabilities: campaign.capabilities,
    });
  });

  it("names the cached list each catalogue.changed kind refreshes, and none for a kind it doesn't cache (BUG-80)", () => {
    expect(
      ["items", "item_properties", "skills", "spells", "specials", "races", "bestiary"].map(
        catalogueKindOf
      )
    ).toEqual(["items", "item-properties", "skills", "spells", "specials", "races", "bestiary"]);
    expect(catalogueKindOf("hired_swords")).toBe("hired-swords");
    expect(catalogueKindOf("dramatis_personae")).toBe("dramatis-personae");
    expect(catalogueKindOf("restrictions")).toBeNull();
  });

  it("listens only while you are in that campaign", async () => {
    const view = renderCampaignRoute("/campaigns/1/skills");
    await waitFor(() => expect(fakeRealtime.subscriberCount(EVENTS, "campaign.updated")).toBe(1));

    view.unmount();

    expect(fakeRealtime.subscriberCount(EVENTS)).toBe(0);
  });
});
