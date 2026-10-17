import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listNotifications } from "@/features/notifications/api/notifications-api";
import type { TradeRequest, TradeSession } from "@/features/warbands/types/trade-request-types";
import { subscribe } from "@/lib/realtime/client";
import { AppStoreProvider, useAppStore } from "@/stores/app-store";
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

const tradeSession: TradeSession = {
  requestId: "trade-9",
  campaignId: 7,
  partner: { id: 2, label: "Mira" },
  fromWarband: { id: 20, name: "Reiklanders" },
  toWarband: { id: 10, name: "Possessed" },
  status: "pending",
  expiresAt: "2099-01-01T00:00:00Z",
  role: "recipient",
};

function Harness() {
  useNotificationSubscription();
  const { setCurrentBattleSession, setTradeSession, tradeRequestNotifications } = useAppStore();
  return (
    <>
      <p>{tradeRequestNotifications.length} trade requests</p>
      <button
        onClick={() => setCurrentBattleSession({ battleId: 3, campaignId: 7, status: "prebattle" })}
      >
        Enter battle
      </button>
      <button onClick={() => setTradeSession(tradeSession)}>Start trade</button>
    </>
  );
}

const renderHarness = () =>
  render(
    <AppStoreProvider>
      <MemoryRouter>
        <Harness />
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
});
