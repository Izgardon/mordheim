import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppStoreProvider } from "@/stores/app-store";
import { renderWithQueryClient } from "@/test/query-test-utils";
import CampaignLayout from "./CampaignLayout";
import { getCampaign } from "../api/campaigns-api";
import { listItems } from "@/features/items/api/items-api";
import { listRaces } from "@/features/races/api/races-api";
import { listSkills } from "@/features/skills/api/skills-api";
import { listSpecial } from "@/features/special/api/special-api";
import { listSpells } from "@/features/spells/api/spells-api";

import type { CampaignSummary } from "../types/campaign-types";

const { never } = vi.hoisted(() => ({ never: () => new Promise<never>(() => undefined) }));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 1, email: "raider@example.com" } }),
}));

vi.mock("@/features/realtime/hooks/useNotifications", () => ({
  useNotifications: () => ({
    tradeRequestNotifications: [],
    battleInviteNotifications: [],
    battleResultRequestNotifications: [],
    acceptTradeNotification: vi.fn(),
    declineTradeNotification: vi.fn(),
    acceptBattleInviteNotification: vi.fn(),
    dismissBattleInviteNotification: vi.fn(),
    acceptBattleResultRequestNotification: vi.fn(),
    declineBattleResultRequestNotification: vi.fn(),
    clearNotifications: vi.fn(),
  }),
}));

vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));
vi.mock("@/features/realtime/components/CampaignChatMenu", () => ({ default: () => null }));
vi.mock("@/features/realtime/components/NotificationsMenu", () => ({ default: () => null }));
vi.mock("@/components/ui/loading-screen", () => ({
  LoadingScreen: ({ message }: { message?: string }) => <p>{message ?? "Loading..."}</p>,
}));

vi.mock("../api/campaigns-api", () => ({ getCampaign: vi.fn() }));
vi.mock("@/features/warbands/api/warbands-api", () => ({
  getWarband: vi.fn(async () => null),
  getWarbandSummary: vi.fn(),
}));
vi.mock("@/features/battles/api/battles-api", () => ({
  listOpenCampaignBattles: vi.fn(async () => []),
}));
vi.mock("@/features/items/api/items-api", () => ({ listItems: vi.fn(never) }));
vi.mock("@/features/skills/api/skills-api", () => ({ listSkills: vi.fn(never) }));
vi.mock("@/features/spells/api/spells-api", () => ({ listSpells: vi.fn(never) }));
vi.mock("@/features/special/api/special-api", () => ({ listSpecial: vi.fn(never) }));
vi.mock("@/features/races/api/races-api", () => ({ listRaces: vi.fn(never) }));

const campaign = {
  id: 7,
  name: "Shards of the Comet",
  role: "player",
  in_progress: true,
  enable_locations: false,
  enable_encampments: false,
} as CampaignSummary;

function renderLayout() {
  return renderWithQueryClient(
    <AppStoreProvider>
      <MemoryRouter initialEntries={["/campaigns/7"]}>
        <Routes>
          <Route path="/campaigns/:id" element={<CampaignLayout />}>
            <Route index element={<p>Overview page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppStoreProvider>
  );
}

describe("CampaignLayout", () => {
  beforeEach(() => {
    vi.mocked(getCampaign).mockReset();
  });

  it("renders the page as soon as the campaign loads, without waiting for catalogues", async () => {
    vi.mocked(getCampaign).mockResolvedValue(campaign);

    renderLayout();

    expect(await screen.findByText("Overview page")).toBeInTheDocument();
    expect(screen.queryByText("Preparing the campaign...")).not.toBeInTheDocument();
    for (const listCatalogue of [listItems, listSkills, listSpells, listSpecial, listRaces]) {
      expect(listCatalogue).not.toHaveBeenCalled();
    }
  });

  it("shows the loading screen until the campaign itself arrives", () => {
    vi.mocked(getCampaign).mockImplementation(never);

    renderLayout();

    expect(screen.getByText("Preparing the campaign...")).toBeInTheDocument();
    expect(screen.queryByText("Overview page")).not.toBeInTheDocument();
  });
});
