/**
 * Requests a cold visit to your own warband sends: the campaign list resolves your warband and
 * one `sheet/` read brings the rest; the campaign layout and the page share that cache entry.
 */
import { act, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import CampaignLayout from "@/features/campaigns/routes/CampaignLayout";
import Warband from "./Warband";
import { createQueryClient } from "@/lib/query-client";
import { AppStoreProvider } from "@/stores/app-store";
import { renderWithQueryClient } from "@/test/query-test-utils";
import {
  makeVeteranHenchmenGroup,
  makeVeteranHero,
  makeVeteranHiredSword,
} from "@/test/warband-fixtures";

const requests = vi.hoisted(() => ({ paths: [] as string[] }));
const never = vi.hoisted(() => () => new Promise<never>(() => undefined));

const warband = {
  id: 9,
  campaign_id: 7,
  user_id: 1,
  name: "The Black Wolves",
  faction: "Mercenaries",
  max_units: 15,
  created_at: "",
  updated_at: "",
};

const responses: Record<string, () => unknown> = {
  "/campaigns/7/": () => ({
    id: 7,
    name: "Shards of the Comet",
    role: "owner",
    in_progress: true,
    max_heroes: 6,
    max_hired_swords: 3,
    permissions: [],
  }),
  "/campaigns/7/battles/?open=1": () => [],
  "/warbands/?campaign_id=7": () => [warband],
  "/warbands/9/sheet/": () => ({
    warband,
    summary: { gold: 120, rating: 99, resources: [] },
    capabilities: {
      edit: true,
      level_up: true,
      manage_items: true,
      edit_backstory: true,
      delete: true,
      edit_catalogue: true,
    },
    heroes: [makeVeteranHero()],
    henchmen_groups: [makeVeteranHenchmenGroup()],
    hired_swords: [makeVeteranHiredSword()],
  }),
};

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: vi.fn(async (path: string) => {
    requests.paths.push(path);
    const respond = responses[path];
    return respond ? respond() : never();
  }),
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 1, email: "raider@example.com" } }),
}));
const notifications = vi.hoisted(() => ({
  tradeRequestNotifications: [],
  battleInviteNotifications: [],
  battleResultRequestNotifications: [],
  acceptTradeNotification: () => undefined,
  declineTradeNotification: () => undefined,
  acceptBattleInviteNotification: () => undefined,
  declineBattleInviteNotification: () => undefined,
  acceptBattleResultRequestNotification: () => undefined,
  declineBattleResultRequestNotification: () => undefined,
  clearNotifications: () => undefined,
}));
vi.mock("@/features/realtime/hooks/useNotifications", () => ({
  useNotifications: () => notifications,
}));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));
vi.mock("@/features/realtime/components/CampaignChatMenu", () => ({ default: () => null }));
vi.mock("@/features/realtime/components/NotificationsMenu", () => ({ default: () => null }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const countOf = (path: string) => requests.paths.filter((p) => p === path).length;

describe("cold warband page load", () => {
  it("fetches your warband from the campaign list, then its sheet, once each", async () => {
    renderWithQueryClient(
      <AppStoreProvider>
        <MemoryRouter initialEntries={["/campaigns/7/warband"]}>
          <Routes>
            <Route path="/campaigns/:id" element={<CampaignLayout />}>
              <Route path="warband" element={<Warband />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>,
      // The app's own cache rules (30 s staleTime): with the test default of 0, whether the page
      // mounts before or after the layout's sheet read lands decides a second read, so the count
      // would depend on module-loading speed rather than on the app.
      { queryClient: createQueryClient() }
    );

    expect(await screen.findByText("Aldric the Bold")).toBeInTheDocument();
    // Gives a late duplicate request the chance to start before counting.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect({
      warband: countOf("/warbands/?campaign_id=7"),
      sheet: countOf("/warbands/9/sheet/"),
      otherWarbandReads: requests.paths.filter(
        (p) => p.startsWith("/warbands/") && !p.endsWith("/sheet/") && !p.includes("campaign_id")
      ),
    }).toEqual({ warband: 1, sheet: 1, otherWarbandReads: [] });
  });
});
