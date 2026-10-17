/**
 * Characterisation of where the trade dialog appears (BUG-43) before pass 2: the warband page
 * renders it from the app store's trade session on any warband, so opening another player's
 * warband mid-trade offers that warband's heroes, stash and gold. The real page, app store and
 * router run; `apiRequest` is answered by a fake server and the trade channel is stubbed.
 */
import { act, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import Warband from "./Warband";
import { AppStoreProvider, useAppStore } from "@/stores/app-store";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeStashItem, makeVeteranHero } from "@/test/warband-fixtures";

import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import type { TradeRequest, TradeSession } from "@/features/warbands/types/trade-request-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 1, email: "ann@example.com" } }),
}));
vi.mock("@/lib/realtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/realtime")>()),
  useTradeEvents: () => undefined,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const TRADE = "7b5c0d2e-trade";
const expiresAt = () => new Date(Date.now() + 5 * 60_000).toISOString();

/** Ann (warband 9) is trading with Bob (warband 12). */
const session = (): TradeSession => ({
  requestId: TRADE,
  campaignId: 7,
  partner: { id: 2, label: "Bob" },
  fromWarband: { id: 9, name: "The Black Wolves" },
  toWarband: { id: 12, name: "Reikland Rats" },
  status: "active",
  expiresAt: expiresAt(),
  role: "initiator",
});

const request = (): TradeRequest => ({
  id: TRADE,
  campaign_id: 7,
  status: "accepted",
  created_at: new Date().toISOString(),
  expires_at: expiresAt(),
  from_offer: { trader_id: null, gold: 0, items: [] },
  to_offer: { trader_id: null, gold: 0, items: [] },
  from_accepted: false,
  to_accepted: false,
  from_user: { id: 1, label: "Ann" },
  to_user: { id: 2, label: "Bob" },
  from_warband: { id: 9, name: "The Black Wolves" },
  to_warband: { id: 12, name: "Reikland Rats" },
  channel: `private-trade-${TRADE}`,
});

/** Carl's warband, which Ann opens while her trade with Bob is running. */
const carlsWarband = {
  id: 15,
  campaign_id: 7,
  user_id: 3,
  name: "Grave Robbers",
  faction: "Undead",
  max_units: 15,
  created_at: "",
  updated_at: "",
};
const vargo = makeVeteranHero({ id: 51, warband_id: 15, name: "Vargo", trading_action: true });

/** Ann's own warband. */
const annsWarband = { ...carlsWarband, id: 9, user_id: 1, name: "The Black Wolves" };
const aldric = makeVeteranHero({ trading_action: true });

const campaign = {
  id: 7,
  name: "Shards of the Comet",
  role: "player",
  in_progress: true,
  max_heroes: 6,
  max_hired_swords: 3,
  permissions: [],
} as unknown as CampaignLayoutContext["campaign"];

/** A trade session started earlier, on Ann's own warband page. */
function RunningTrade() {
  const { setTradeSession } = useAppStore();
  useEffect(() => setTradeSession(session()), [setTradeSession]);
  return null;
}

const renderPage = (url: string) =>
  renderWithQueryClient(
    <AppStoreProvider>
      <RunningTrade />
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="/campaigns/:id"
            element={
              <Outlet
                context={{
                  campaign,
                  setMobileTopBar: () => undefined,
                  showRejoinBattleButton: false,
                }}
              />
            }
          >
            <Route path="warband" element={<Warband />} />
            <Route path="warbands/:warbandId" element={<Warband />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppStoreProvider>
  );

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /warbands/15/sheet/", {
    warband: carlsWarband,
    summary: { gold: 75, rating: 40, resources: [] },
    capabilities: {},
    heroes: [vargo],
    henchmen_groups: [],
    hired_swords: [],
  });
  fakeApi.on("GET /warbands/15/items/", [
    makeStashItem({ id: 300, name: "Wyrdstone", cost: 0, quantity: 3 }),
  ]);
  fakeApi.on(`GET /campaigns/7/trade-requests/${TRADE}/`, request());
  fakeApi.on("GET /warbands/?campaign_id=7", [annsWarband]);
  fakeApi.on("GET /warbands/9/sheet/", {
    warband: annsWarband,
    summary: { gold: 120, rating: 99, resources: [] },
    capabilities: { edit: true, manage_items: true },
    heroes: [aldric],
    henchmen_groups: [],
    hired_swords: [],
  });
  fakeApi.on("GET /warbands/9/items/", [
    makeStashItem({ id: 101, name: "Sword", cost: 10, quantity: 2 }),
  ]);
});

describe("Warband page: the trade dialog", () => {
  it("opens on your own warband with your heroes, stash and gold", async () => {
    const user = setupUser();
    renderPage("/campaigns/7/warband");

    const dialog = await screen.findByRole("dialog", { name: "Trading with Bob" });
    expect(await within(dialog).findByRole("button", { name: "Sword 2/2" })).toBeInTheDocument();
    expect(within(dialog).getByText("Available: 120 gc")).toBeInTheDocument();
    act(() => within(dialog).getByRole("combobox").focus());
    await user.keyboard("{Enter}");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "None",
      "Aldric the Bold",
    ]);
  });

  it("opens on another player's warband, offering that warband's heroes, stash and gold (BUG-43, pinned; flips in PR A)", async () => {
    const user = setupUser();
    renderPage("/campaigns/7/warbands/15");

    const dialog = await screen.findByRole("dialog", { name: "Trading with Bob" });
    expect(
      await within(dialog).findByRole("button", { name: "Wyrdstone 3/3" })
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Available: 75 gc")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual(
      expect.arrayContaining([
        "GET /warbands/15/sheet/",
        `GET /campaigns/7/trade-requests/${TRADE}/`,
        "GET /warbands/15/items/",
      ])
    );

    // Carl's hero is offered as Ann's trader.
    act(() => within(dialog).getByRole("combobox").focus());
    await user.keyboard("{Enter}");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "None",
      "Vargo",
    ]);
  });
});
