import { act, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppStoreProvider } from "@/stores/app-store";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import CampaignLayout from "./CampaignLayout";
import BattleActionPanel from "../components/overview/BattleActionPanel";
import { getCampaign } from "../api/campaigns-api";
import { listOpenCampaignBattles } from "@/features/battles/api/battles-api";
import { listItems } from "@/features/items/api/items-api";
import { listRaces } from "@/features/races/api/races-api";
import { listSkills } from "@/features/skills/api/skills-api";
import { listSpecial } from "@/features/special/api/special-api";
import { listSpells } from "@/features/spells/api/spells-api";

import type { BattleState } from "@/features/battles/types/battle-types";
import type { CampaignSummary } from "../types/campaign-types";

const { never } = vi.hoisted(() => ({ never: () => new Promise<never>(() => undefined) }));

const { auth } = vi.hoisted(() => ({ auth: { user: { id: 1, email: "raider@example.com" } } }));

vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => auth }));

// Stable values, like the real hook (fresh arrays per render would loop the top-bar effect).
const { notifications } = vi.hoisted(() => ({
  notifications: {
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
  },
}));

vi.mock("@/features/realtime/hooks/useNotifications", () => ({
  useNotifications: () => notifications,
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
  listOpenCampaignBattles: vi.fn(),
  joinBattle: vi.fn(),
  cancelBattleAsCreator: vi.fn(),
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

const openBattle = {
  battle: {
    id: 31,
    campaign_id: 7,
    status: "prebattle",
    flow_type: "normal",
    created_by_user_id: 2,
  },
  participants: [{ user: { id: 1 }, status: "accepted" }],
} as unknown as BattleState;

/** Gives any duplicate request a chance to start before asserting it did not. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

type LayoutOptions = {
  queryClient?: ReturnType<typeof createTestQueryClient>;
  path?: string;
  page?: ReactNode;
};

function renderLayout({
  queryClient = createTestQueryClient(),
  path = "/campaigns/7",
  page = <p>Overview page</p>,
}: LayoutOptions = {}) {
  return renderWithQueryClient(
    <AppStoreProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/campaigns/:id" element={<CampaignLayout />}>
            <Route index element={page} />
            <Route path="skills" element={page} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppStoreProvider>,
    { queryClient }
  );
}

describe("CampaignLayout", () => {
  beforeEach(() => {
    vi.mocked(getCampaign).mockReset();
    vi.mocked(listOpenCampaignBattles).mockReset();
    vi.mocked(listOpenCampaignBattles).mockResolvedValue([]);
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

  it("reuses the cached campaign when the layout mounts again", async () => {
    vi.mocked(getCampaign).mockResolvedValue(campaign);
    const queryClient = createTestQueryClient();

    const first = renderLayout({ queryClient });
    expect(await screen.findByText("Overview page")).toBeInTheDocument();
    first.unmount();

    renderLayout({ queryClient });

    expect(screen.getByText("Overview page")).toBeInTheDocument();
    expect(getCampaign).toHaveBeenCalledTimes(1);
  });

  it("shows the loading screen until the campaign itself arrives", () => {
    vi.mocked(getCampaign).mockImplementation(never);

    renderLayout();

    expect(screen.getByText("Preparing the campaign...")).toBeInTheDocument();
    expect(screen.queryByText("Overview page")).not.toBeInTheDocument();
  });

  it("shares one open-battles request between the layout and the battle panel", async () => {
    vi.mocked(getCampaign).mockResolvedValue(campaign);

    renderLayout({
      page: <BattleActionPanel campaignId={7} players={[]} campaignStarted={false} />,
    });

    await waitFor(() => expect(listOpenCampaignBattles).toHaveBeenCalled());
    await settle();
    expect(listOpenCampaignBattles).toHaveBeenCalledTimes(1);
  });

  it("does not refetch open battles when focus and visibilitychange fire together", async () => {
    vi.mocked(getCampaign).mockResolvedValue(campaign);
    renderLayout({
      page: <BattleActionPanel campaignId={7} players={[]} campaignStarted={false} />,
    });
    await waitFor(() => expect(listOpenCampaignBattles).toHaveBeenCalledTimes(1));

    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    });

    await settle();
    expect(listOpenCampaignBattles).toHaveBeenCalledTimes(1);
  });

  it("offers Rejoin Battle and refetches when a realtime battle event arrives", async () => {
    vi.mocked(getCampaign).mockResolvedValue(campaign);
    vi.mocked(listOpenCampaignBattles).mockResolvedValueOnce([openBattle]);
    renderLayout({ path: "/campaigns/7/skills", page: <p>Skills page</p> });

    expect(await screen.findByRole("button", { name: "Rejoin Battle" })).toBeInTheDocument();

    // The battle ended elsewhere; the realtime handler fires battle:status-updated.
    act(() => {
      window.dispatchEvent(new CustomEvent("battle:status-updated"));
    });

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Rejoin Battle" })).not.toBeInTheDocument()
    );
    expect(listOpenCampaignBattles).toHaveBeenCalledTimes(2);
  });
});
