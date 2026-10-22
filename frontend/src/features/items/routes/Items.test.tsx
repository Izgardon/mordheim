/**
 * The campaign's wargear list as the app mounts it (layout, fake server): a custom item and a
 * house rule's clone both offer Edit; editing the clone detaches it from its rule (PR C's Calls,
 * replacing BUG-51's 403).
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignSummary, routeCampaignShell } from "@/test/campaign-fixtures";
import { renderCampaignRoute } from "@/test/campaign-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";

import type { Item } from "../types/item-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "aldric@example.com" }, signOut: () => undefined }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const weapon = (overrides: Partial<Item>): Item => ({
  id: 1,
  campaign_id: 1,
  name: "Sword",
  type: "Weapon",
  subtype: "Melee",
  description: "",
  availabilities: [],
  generated_effect_key: null,
  ...overrides,
});

/** An item's row (the table makes each row a button that expands it). */
const row = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell({ campaign: campaignSummary() });
  fakeApi.on("GET /items/?campaign_id=1", [
    weapon({ id: 1, name: "Rusty Cleaver" }),
    weapon({ id: 2, name: "Cheap Shield", generated_effect_key: "half_price_armour" }),
  ]);
  fakeApi.on("GET /item-properties/?campaign_id=1", []);
});

describe("Items: house rule clones", () => {
  it("offers Edit on a custom item and on a house rule's clone, whose edit detaches it (PR C's Calls)", async () => {
    renderCampaignRoute("/campaigns/1/items");

    expect(await screen.findByText("Rusty Cleaver")).toBeInTheDocument();
    expect(within(row("Rusty Cleaver")).getByRole("button", { name: "Edit item" })).toBeVisible();
    expect(within(row("Cheap Shield")).getByRole("button", { name: "Edit item" })).toBeVisible();
  });
});
