/**
 * Item actions on the warband page act on the warband on screen (BUG-107), also for a campaign
 * admin with no warband of their own who manages another player's warband. The real page, app
 * store and router run; `apiRequest` is answered by a fake server.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import Warband from "./Warband";
import { AppStoreProvider } from "@/stores/app-store";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { chooseOption, selectNear } from "@/test/select-option";
import { setupUser } from "@/test/user-event";
import { makeStashItem, makeVeteranHero } from "@/test/warband-fixtures";

import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 2, email: "admin@example.com" } }),
}));
vi.mock("@/lib/realtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/realtime")>()),
  useTradeEvents: () => undefined,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

/** Carl's warband, which the admin (no warband of their own) manages. */
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
const vargo = makeVeteranHero({ id: 51, warband_id: 15, name: "Vargo", unit_type: "Necromancer" });

const campaign = {
  id: 7,
  name: "Shards of the Comet",
  role: "admin",
  in_progress: true,
  max_heroes: 6,
  max_hired_swords: 3,
  permissions: ["manage_warbands"],
} as unknown as CampaignLayoutContext["campaign"];

const renderCarlsWarband = () =>
  renderWithQueryClient(
    <AppStoreProvider>
      <MemoryRouter initialEntries={["/campaigns/7/warbands/15"]}>
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
    summary: {
      gold: 75,
      rating: 40,
      resources: [],
      heroes: [{ id: 51, warband_id: 15, name: "Vargo", unit_type: "Necromancer", xp: 7 }],
      hired_swords: [],
      henchmen_groups: [],
    },
    capabilities: { edit: true, manage_items: true },
    heroes: [vargo],
    henchmen_groups: [],
    hired_swords: [],
  });
  fakeApi.on("GET /warbands/15/items/", [
    makeStashItem({ id: 300, name: "Wyrdstone", cost: 0, quantity: 3 }),
  ]);
});

describe("Warband page: item actions on another player's warband (BUG-107)", () => {
  it("offers that warband's heroes as Move targets to an admin without a warband", async () => {
    const user = setupUser();
    renderCarlsWarband();

    await user.click(await screen.findByRole("button", { name: "Warband stash" }));
    const row = (await screen.findByText("Wyrdstone x 3")).parentElement as HTMLElement;
    await user.click(within(row).getByRole("button"));
    await user.click(screen.getByRole("button", { name: "Move" }));
    const dialog = screen.getByRole("dialog", { name: "Move Wyrdstone" });
    await chooseOption(user, selectNear("Unit Type", dialog), "Heroes");
    await user.click(selectNear("Hero", dialog));

    await waitFor(() =>
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "Vargo - Necromancer",
      ])
    );
    expect(fakeApi.calls().some((call) => call.includes("henchmen-groups"))).toBe(false);
  });
});
