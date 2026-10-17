import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useEffect, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useOutletContext } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppStoreProvider, useAppStore } from "@/stores/app-store";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import CampaignLayout from "./CampaignLayout";
import BattleActionPanel from "../components/overview/BattleActionPanel";
import { getCampaign } from "../api/campaigns-api";
import { listOpenCampaignBattles } from "@/features/battles/api/battles-api";
import { invalidateOpenBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import { listItems } from "@/features/items/api/items-api";
import { listRaces } from "@/features/races/api/races-api";
import { listSkills } from "@/features/skills/api/skills-api";
import { listSpecial } from "@/features/special/api/special-api";
import { listSpells } from "@/features/spells/api/spells-api";

import type { BattleState } from "@/features/battles/types/battle-types";
import type { CampaignSummary } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";

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
    const { queryClient } = renderLayout({ path: "/campaigns/7/skills", page: <p>Skills page</p> });

    expect(await screen.findByRole("button", { name: "Rejoin Battle" })).toBeInTheDocument();

    // The battle ended elsewhere; the realtime handler invalidates the open battles.
    act(() => {
      void invalidateOpenBattles(queryClient, 7);
    });

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Rejoin Battle" })).not.toBeInTheDocument()
    );
    expect(listOpenCampaignBattles).toHaveBeenCalledTimes(2);
  });
});

/** A matchMedia whose (max-width: 960px) answer the test can flip, like rotating a tablet. */
function controllableViewport() {
  let isMobile = false;
  const listeners = new Set<() => void>();
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return isMobile;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return {
    setMobile(next: boolean) {
      isMobile = next;
      act(() => listeners.forEach((listener) => listener()));
    },
    restore() {
      window.matchMedia = original;
    },
  };
}

const pageMounts = vi.fn();
const pageRenders = vi.fn();

/** Changes the app store from outside the page, as an arriving notification does. */
function StoreNudger() {
  const { setWarbandError } = useAppStore();
  return (
    <button
      type="button"
      onClick={() => {
        // The default top bar is rebuilt from the new notification list.
        (notifications as { tradeRequestNotifications: unknown[] }).tradeRequestNotifications = [];
        setWarbandError(`changed ${Date.now()}`);
      }}
    >
      Something changes elsewhere
    </button>
  );
}

/** A page with local state and a mobile top-bar override, like Warband edit mode. */
function EditingPage() {
  const { setMobileTopBar } = useOutletContext<CampaignLayoutContext>();
  const [draft, setDraft] = useState("");
  pageRenders();

  useEffect(() => {
    pageMounts();
  }, []);

  useLayoutEffect(() => {
    setMobileTopBar?.({ title: "Edit Hero", rightSlot: <button type="button">Save edits</button> });
  }, [setMobileTopBar]);

  return <input aria-label="Hero name" value={draft} onChange={(e) => setDraft(e.target.value)} />;
}

function renderShell(path = "/campaigns/7/skills") {
  return renderWithQueryClient(
    <AppStoreProvider>
      <StoreNudger />
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/campaigns/:id" element={<CampaignLayout />}>
            <Route path="skills" element={<EditingPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppStoreProvider>
  );
}

describe("CampaignLayout shell", () => {
  let viewport: ReturnType<typeof controllableViewport>;

  beforeEach(() => {
    vi.mocked(getCampaign).mockReset();
    vi.mocked(getCampaign).mockResolvedValue(campaign);
    vi.mocked(listOpenCampaignBattles).mockReset();
    vi.mocked(listOpenCampaignBattles).mockResolvedValue([]);
    pageMounts.mockClear();
    pageRenders.mockClear();
    viewport = controllableViewport();
  });

  afterEach(() => {
    viewport.restore();
  });

  it("keeps the page mounted, with its state, when the viewport crosses 960 px (BUG-23)", async () => {
    renderShell();
    fireEvent.change(await screen.findByLabelText("Hero name"), { target: { value: "Aldric" } });

    viewport.setMobile(true);
    expect(await screen.findByRole("navigation")).toBeInTheDocument();
    viewport.setMobile(false);

    expect(screen.getByLabelText("Hero name")).toHaveValue("Aldric");
    expect(pageMounts).toHaveBeenCalledTimes(1);
  });

  it("keeps a page's mobile top-bar override when the default bar changes (BUG-24)", async () => {
    viewport.setMobile(true);
    renderShell();
    expect(await screen.findByRole("button", { name: "Save edits" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Something changes elsewhere" }));

    await act(async () => undefined);
    expect(screen.getByRole("button", { name: "Save edits" })).toBeInTheDocument();
  });
});
