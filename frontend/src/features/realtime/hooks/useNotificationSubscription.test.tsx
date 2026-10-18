import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listNotifications } from "@/features/notifications/api/notifications-api";
import type { TradeRequest } from "@/features/warbands/types/trade-request-types";
import { subscribe } from "@/lib/realtime/client";
import { AppToaster } from "@/components/ui/toaster";
import { AppStoreProvider, useAppStore } from "@/stores/app-store";
import { queryKeys } from "@/lib/query-keys";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { useNotificationSubscription } from "./useNotificationSubscription";

const { auth } = vi.hoisted(() => ({ auth: { user: { id: 1, email: "raider@example.com" } } }));

vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/features/notifications/api/notifications-api", () => ({
  listNotifications: vi.fn(async () => []),
  clearNotification: vi.fn(),
  clearAllNotifications: vi.fn(),
}));
vi.mock("@/lib/realtime/client", () => ({
  subscribe: vi.fn(() => () => undefined),
  onConnectionRestored: vi.fn(() => () => undefined),
}));

const tradeRequest = {
  id: "trade-9",
  campaign_id: 7,
  status: "pending",
  created_at: "2026-10-17T10:00:00Z",
  expires_at: "2099-01-01T00:00:00Z",
  from_user: { id: 2, label: "Mira" },
  to_user: { id: 1, label: "Raider" },
  from_warband: { id: 20, name: "Reiklanders" },
  to_warband: { id: 10, name: "Possessed" },
} as TradeRequest;

function CurrentLocation() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function Harness() {
  useNotificationSubscription();
  const { setCurrentBattleSession, tradeRequestNotifications } = useAppStore();
  const queryClient = useQueryClient();
  return (
    <>
      <p>{tradeRequestNotifications.length} trade requests</p>
      <button
        onClick={() => setCurrentBattleSession({ battleId: 3, campaignId: 7, status: "prebattle" })}
      >
        Enter battle
      </button>
      {/* A trade this browser has open: the trade query holds it. */}
      <button
        onClick={() =>
          queryClient.setQueryData(queryKeys.campaign.trade(7, "trade-9"), tradeRequest)
        }
      >
        Start trade
      </button>
    </>
  );
}

const renderHarness = (path = "/campaigns/7/skills") =>
  renderWithQueryClient(
    <AppStoreProvider>
      <MemoryRouter initialEntries={[path]}>
        <Harness />
        <CurrentLocation />
        <AppToaster />
      </MemoryRouter>
    </AppStoreProvider>
  );

const notificationHandler = () => {
  const call = vi
    .mocked(subscribe)
    .mock.calls.find(([channel]) => channel.startsWith("private-user-1-"));
  return call?.[2] as (data: unknown) => void;
};

describe("useNotificationSubscription", () => {
  beforeEach(() => {
    vi.mocked(subscribe).mockClear();
    vi.mocked(listNotifications).mockClear();
  });

  it("subscribes and loads once; battle and trade session changes don't resubscribe or refetch", async () => {
    renderHarness();
    await waitFor(() => expect(listNotifications).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Enter battle" }));
    fireEvent.click(screen.getByRole("button", { name: "Start trade" }));
    await act(async () => undefined);

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(
      "private-user-1-notifications",
      "notification",
      expect.any(Function)
    );
    expect(listNotifications).toHaveBeenCalledTimes(1);
  });

  it("adds a trade request that arrives in realtime", async () => {
    renderHarness();
    await waitFor(() => expect(notificationHandler()).toBeDefined());

    act(() => notificationHandler()({ type: "trade_request", payload: tradeRequest }));

    expect(screen.getByText("1 trade requests")).toBeInTheDocument();
  });

  it("ends your pending request when the recipient declines it, and says so", async () => {
    renderHarness();
    await waitFor(() => expect(notificationHandler()).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Start trade" }));

    act(() =>
      notificationHandler()({
        type: "trade_declined",
        payload: {
          ...tradeRequest,
          status: "declined",
          from_user: { id: 1, label: "Raider" },
          to_user: { id: 2, label: "Mira" },
        },
      })
    );

    expect(await screen.findByText("Mira declined the trade.")).toBeInTheDocument();
  });

  it("offers an accepted trade in a toast instead of navigating away (BUG-26)", async () => {
    renderHarness();
    await waitFor(() => expect(notificationHandler()).toBeDefined());

    act(() =>
      notificationHandler()({
        type: "trade_accepted",
        payload: {
          ...tradeRequest,
          from_user: { id: 1, label: "Raider" },
          to_user: { id: 2, label: "Mira" },
        },
      })
    );

    expect(await screen.findByText("Mira accepted your trade")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/campaigns/7/skills");

    fireEvent.click(screen.getByRole("button", { name: "Open trade" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/campaigns/7/warband?trade=trade-9");
  });

  it("offers an opened prebattle in a toast instead of navigating away (BUG-26)", async () => {
    const { queryClient } = renderHarness("/campaigns/7/warband");
    await waitFor(() => expect(notificationHandler()).toBeDefined());
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    act(() =>
      notificationHandler()({
        type: "battle_prebattle_opened",
        payload: { battle_id: 41, campaign_id: 7, title: "Ambush at the Well" },
      })
    );

    expect(await screen.findByText("Prebattle is open for Ambush at the Well")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/campaigns/7/warband");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["campaign", 7, "battles", "open"] });

    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/campaigns/7/battles/41/prebattle");
  });

  it("refreshes the open battles when a battle result changes", async () => {
    const { queryClient } = renderHarness();
    await waitFor(() => expect(notificationHandler()).toBeDefined());
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    act(() =>
      notificationHandler()({
        type: "battle_result_updated",
        payload: { battle_id: 41, campaign_id: 7, status: "ended" },
      })
    );

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["campaign", 7, "battles", "open"] });
  });
});
