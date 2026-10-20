import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
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

/**
 * A toast's action closes it and sonner removes it 200 ms later on a timer. Waiting for that keeps
 * the timer inside the test: one still pending when the file's environment is torn down throws
 * "window is not defined" and fails the run.
 */
const waitForToastToGo = (toastText: HTMLElement) =>
  waitFor(() => expect(toastText).not.toBeInTheDocument());

function CurrentLocation() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function Harness() {
  useNotificationSubscription();
  const { setCurrentBattleSession, tradeRequestNotifications, battleNudgeNotifications } =
    useAppStore();
  const queryClient = useQueryClient();
  return (
    <>
      <p>{tradeRequestNotifications.length} trade requests</p>
      <p>{battleNudgeNotifications.map((nudge) => nudge.fromLabel).join(", ") || "No nudges"}</p>
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

  it("closes a trade shown here when trade_closed says how it ended, and drops its request (decision 8)", async () => {
    const { queryClient } = renderHarness();
    await waitFor(() => expect(notificationHandler()).toBeDefined());
    act(() => notificationHandler()({ type: "trade_request", payload: tradeRequest }));
    expect(screen.getByText("1 trade requests")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start trade" }));

    act(() =>
      notificationHandler()({
        type: "trade_closed",
        payload: { ...tradeRequest, status: "cancelled" },
      })
    );

    expect(await screen.findByText("Mira cancelled the trade.")).toBeInTheDocument();
    expect(screen.getByText("0 trade requests")).toBeInTheDocument();
    expect(
      queryClient.getQueryData<TradeRequest>(queryKeys.campaign.trade(7, "trade-9"))?.status
    ).toBe("cancelled");
  });

  it("says nothing on trade_closed for a trade this browser doesn't show", async () => {
    const { queryClient } = renderHarness();
    await waitFor(() => expect(notificationHandler()).toBeDefined());

    act(() =>
      notificationHandler()({
        type: "trade_closed",
        payload: { ...tradeRequest, status: "expired" },
      })
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    expect(screen.queryByText("The trade request expired.")).not.toBeInTheDocument();
    expect(queryClient.getQueryData(queryKeys.campaign.trade(7, "trade-9"))).toBeUndefined();
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

    const toastText = await screen.findByText("Mira accepted your trade");
    expect(screen.getByTestId("location")).toHaveTextContent("/campaigns/7/skills");

    fireEvent.click(screen.getByRole("button", { name: "Open trade" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/campaigns/7/warband?trade=trade-9");
    await waitForToastToGo(toastText);
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

    const toastText = await screen.findByText("Prebattle is open for Ambush at the Well");
    expect(screen.getByTestId("location")).toHaveTextContent("/campaigns/7/warband");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["campaign", 7, "battles", "open"] });

    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/campaigns/7/battles/41/prebattle");
    await waitForToastToGo(toastText);
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

  it("says who nudged you, with a way to the battle, and keeps the nudge in the bell (BATL-NEW-08)", async () => {
    renderHarness("/campaigns/7/warband");
    await waitFor(() => expect(notificationHandler()).toBeDefined());

    act(() =>
      notificationHandler()({
        type: "battle_nudge",
        payload: {
          battle_id: 41,
          campaign_id: 7,
          scenario: "Ambush at the Well",
          page: "postbattle",
          nudged_by_user_label: "Mira",
          notification_id: 12,
        },
      })
    );

    const toastText = await screen.findByText(
      "Mira nudged you: Ambush at the Well is waiting for you."
    );
    expect(screen.getByText("Mira")).toBeInTheDocument();
    const nudgeToast = toastText.closest("[data-sonner-toast]") as HTMLElement;
    fireEvent.click(within(nudgeToast).getByRole("button", { name: "Go" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/campaigns/7/battles/41/postbattle");
    await waitForToastToGo(toastText);
  });

  it("puts a nudge sent while you were away in the bell (BATL-NEW-08)", async () => {
    vi.mocked(listNotifications).mockResolvedValueOnce([
      {
        id: 12,
        notification_type: "battle_nudge",
        campaign_id: 7,
        reference_id: "41",
        payload: {
          battle_id: 41,
          campaign_id: 7,
          scenario: "Ambush",
          nudged_by_user_label: "Bors",
        },
        created_at: "2026-10-19T10:00:00Z",
      },
    ]);
    renderHarness();

    expect(await screen.findByText("Bors")).toBeInTheDocument();
  });
});
