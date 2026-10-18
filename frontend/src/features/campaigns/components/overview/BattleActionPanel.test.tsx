/**
 * A reported battle result waiting for your approval, seen from the campaign overview: the battle
 * panel ignores it, and only the notification bell can approve or decline it (BUG-46).
 */
import { screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BattleState } from "@/features/battles/types/battle-types";
import NotificationsMenu from "@/features/realtime/components/NotificationsMenu";
import { useNotificationSubscription } from "@/features/realtime/hooks/useNotificationSubscription";
import { useNotifications } from "@/features/realtime/hooks/useNotifications";
import { AppStoreProvider } from "@/stores/app-store";
import { OPPONENT, battleState } from "@/test/battle-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import BattleActionPanel from "./BattleActionPanel";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "owner@example.com" } }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const REPORTED_BATTLE_ID = 41;
const resultPath = (action: string) => `/campaigns/1/battles/${REPORTED_BATTLE_ID}/${action}/`;

/** Mira reported that her Night Razors beat your Iron Vultures; you haven't answered. */
const pendingResult: BattleState = battleState({
  id: REPORTED_BATTLE_ID,
  flow_type: "reported_result",
  status: "reported_result_pending",
  created_by_user_id: OPPONENT.id,
  winner_warband_ids_json: [OPPONENT.warband.id],
  me: { status: "reported_result_pending" },
  opponent: { status: "reported_result_approved" },
});

const answeredResult = (status: "ended" | "canceled"): BattleState => ({
  ...pendingResult,
  battle: { ...pendingResult.battle, status },
});

const resultRequest = {
  id: 31,
  notification_type: "battle_result_request",
  campaign_id: 1,
  reference_id: String(REPORTED_BATTLE_ID),
  payload: {
    battle_id: REPORTED_BATTLE_ID,
    campaign_id: 1,
    title: "Skirmish at the Market Square",
    scenario: "Skirmish at the Market Square",
    battle_date: "2026-10-17",
    winner_warband_ids: [OPPONENT.warband.id],
    winner_warband_names: [OPPONENT.warband.name],
    created_by_user_id: OPPONENT.id,
    created_by_user_label: "Mira",
  },
  created_at: "2026-10-17T20:00:00Z",
};

/** The overview's battle panel next to the layout's bell, as the campaign page shows them. */
function OverviewWithBell() {
  useNotificationSubscription();
  const notifications = useNotifications();
  return (
    <>
      <NotificationsMenu
        tradeRequestNotifications={notifications.tradeRequestNotifications}
        battleInviteNotifications={notifications.battleInviteNotifications}
        battleResultRequestNotifications={notifications.battleResultRequestNotifications}
        onAcceptTrade={notifications.acceptTradeNotification}
        onDeclineTrade={notifications.declineTradeNotification}
        onAcceptBattleInvite={notifications.acceptBattleInviteNotification}
        onDismissBattleInvite={notifications.dismissBattleInviteNotification}
        onAcceptBattleResultRequest={notifications.acceptBattleResultRequestNotification}
        onDeclineBattleResultRequest={notifications.declineBattleResultRequestNotification}
        onClear={notifications.clearNotifications}
      />
      <main aria-label="Overview">
        <BattleActionPanel campaignId={1} players={[]} campaignStarted />
      </main>
    </>
  );
}

async function renderOverview() {
  renderWithQueryClient(
    <AppStoreProvider>
      <MemoryRouter initialEntries={["/campaigns/1"]}>
        <OverviewWithBell />
      </MemoryRouter>
    </AppStoreProvider>
  );
  const overview = screen.getByRole("main", { name: "Overview" });
  expect(await within(overview).findByRole("button", { name: "Start battle" })).toBeEnabled();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveTextContent("1")
  );
  return overview;
}

describe("BattleActionPanel with a reported result awaiting you", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeRealtime.reset();
    fakeApi.on("GET /notifications/", [resultRequest]);
    fakeApi.on("GET /campaigns/1/battles/?open=1", [pendingResult]);
  });

  it("shows only Start battle on the overview; Approve and Decline live in the bell alone (BUG-46, pinned; flips in PR A)", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${resultPath("approve-result")}`, answeredResult("ended"));
    const overview = await renderOverview();

    expect(
      within(overview)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Start battle"]);
    expect(within(overview).queryByText(/Skirmish at the Market Square/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    const bell = screen.getByRole("dialog", { name: "Notifications" });
    expect(bell).toHaveTextContent("Battle result request");
    await user.click(within(bell).getByRole("button", { name: "Approve reported battle result" }));

    await waitFor(() => expect(fakeApi.calls()).toContain(`POST ${resultPath("approve-result")}`));
    expect(fakeApi.bodyOf(`POST ${resultPath("approve-result")}`)).toBeUndefined();
  });

  it("declines from the bell with decline-result/", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${resultPath("decline-result")}`, answeredResult("canceled"));
    await renderOverview();

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(screen.getByRole("button", { name: "Decline reported battle result" }));

    await waitFor(() => expect(fakeApi.calls()).toContain(`POST ${resultPath("decline-result")}`));
    expect(screen.getByRole("button", { name: "Notifications" })).not.toHaveTextContent("1");
  });

  it("leaves nowhere to answer the result once the bell is cleared (BUG-46, pinned; flips in PR A)", async () => {
    const user = setupUser();
    fakeApi.on("POST /notifications/clear-all/", { ok: true });
    const overview = await renderOverview();

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));

    // The server declines the result on clear-all (backend half); the page only clears the bell.
    await waitFor(() => expect(fakeApi.calls()).toContain("POST /notifications/clear-all/"));
    expect(fakeApi.calls()).not.toContain(`POST ${resultPath("decline-result")}`);
    expect(
      within(overview)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Start battle"]);
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("dialog", { name: "Notifications" })).toHaveTextContent(
      "You are all caught up."
    );
  });
});
