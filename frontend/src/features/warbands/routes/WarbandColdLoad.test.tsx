/**
 * Requests a cold visit to your own warband sends: the campaign layout and the warband page
 * share one cache, so each warband read goes out once.
 */
import { act, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import CampaignLayout from "@/features/campaigns/routes/CampaignLayout";
import Warband from "./Warband";
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
  "/warbands/9/summary/": () => ({ gold: 120, rating: 99, resources: [] }),
  "/warbands/9/heroes/": () => [makeVeteranHero()],
  "/warbands/9/henchmen-groups/": () => [makeVeteranHenchmenGroup()],
  "/warbands/9/hired-swords/": () => [makeVeteranHiredSword()],
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
  dismissBattleInviteNotification: () => undefined,
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
  it("fetches the warband, its summary and each unit list once", async () => {
    renderWithQueryClient(
      <AppStoreProvider>
        <MemoryRouter initialEntries={["/campaigns/7/warband"]}>
          <Routes>
            <Route path="/campaigns/:id" element={<CampaignLayout />}>
              <Route path="warband" element={<Warband />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppStoreProvider>
    );

    expect(await screen.findByText("Aldric the Bold")).toBeInTheDocument();
    // Gives a late duplicate request the chance to start before counting.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect({
      warband: countOf("/warbands/?campaign_id=7"),
      summary: countOf("/warbands/9/summary/"),
      heroes: countOf("/warbands/9/heroes/"),
      henchmen: countOf("/warbands/9/henchmen-groups/"),
      hiredSwords: countOf("/warbands/9/hired-swords/"),
    }).toEqual({ warband: 1, summary: 1, heroes: 1, henchmen: 1, hiredSwords: 1 });
  });
});
