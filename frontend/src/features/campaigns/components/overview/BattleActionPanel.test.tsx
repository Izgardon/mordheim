/**
 * A reported battle result waiting for your approval, seen from the campaign overview: a card
 * offers Approve and Decline (and Withdraw to the submitter), and clearing the bell leaves it
 * there to answer (BUG-46).
 */
import { screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BattleState, PendingReportedResult } from "@/features/battles/types/battle-types";
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

/** The same result as `pending-results/` lists it. */
const pendingRow = (overrides: Partial<PendingReportedResult> = {}): PendingReportedResult => ({
  battle_id: REPORTED_BATTLE_ID,
  campaign_id: 1,
  status: "reported_result_pending",
  scenario: "Skirmish at the Market Square",
  battle_date: "2026-10-17",
  winner_warband_ids: [OPPONENT.warband.id],
  winner_warband_names: [OPPONENT.warband.name],
  created_by_user_id: OPPONENT.id,
  created_by_user_label: "Mira",
  created_at: "2026-10-17T20:00:00Z",
  participants: [
    {
      user_id: 7,
      user_label: "Owner",
      warband_id: 101,
      warband_name: "Iron Vultures",
      status: "reported_result_pending",
    },
    {
      user_id: OPPONENT.id,
      user_label: "Mira",
      warband_id: OPPONENT.warband.id,
      warband_name: OPPONENT.warband.name,
      status: "reported_result_approved",
    },
  ],
  awaiting_my_answer: true,
  can_withdraw: false,
  ...overrides,
});

/** What `pending-results/` answers; an answer or a withdraw empties it, as the server does. */
let pending: PendingReportedResult[] = [];
const PENDING_ROUTE = "GET /campaigns/1/battles/pending-results/";

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
        onDeclineBattleInvite={notifications.declineBattleInviteNotification}
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

const card = () => screen.getByRole("region", { name: /Results awaiting/ });

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

describe("BattleActionPanel with a battle invite", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeRealtime.reset();
    fakeApi.on("GET /notifications/", []);
    fakeApi.on(PENDING_ROUTE, []);
    fakeApi.on("GET /campaigns/1/battles/?open=1", [
      battleState({
        status: "inviting",
        created_by_user_id: OPPONENT.id,
        closes_at: new Date(Date.now() + 2 * 86_400_000 + 3_600_000).toISOString(),
        me: { status: "invited" },
        opponent: { status: "accepted" },
      }),
    ]);
  });

  it("lets an invitee decline from the status dialog, after a confirm (BUG-45)", async () => {
    const user = setupUser();
    fakeApi.on("POST /campaigns/1/battles/5/decline/", () =>
      battleState({ status: "canceled", me: { status: "declined" } })
    );
    renderWithQueryClient(
      <AppStoreProvider>
        <MemoryRouter initialEntries={["/campaigns/1"]}>
          <BattleActionPanel campaignId={1} players={[]} campaignStarted />
        </MemoryRouter>
      </AppStoreProvider>
    );

    await user.click(await screen.findByRole("button", { name: "See Status" }));
    // The invite's deadline shows by the button and in the dialog (BUG-10, decision 2).
    expect(screen.getAllByText(/Invites close in 2 days/).length).toBeGreaterThan(0);
    const status = screen.getByRole("dialog", { name: "Battle Status" });
    expect(status).toHaveTextContent("Invites close in 2 days");
    expect(within(status).getByRole("button", { name: "Accept invite" })).toBeInTheDocument();
    await user.click(within(status).getByRole("button", { name: "Decline" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Decline battle" })).getByRole("button", {
        name: "Decline",
      })
    );

    await waitFor(() => expect(fakeApi.calls()).toContain("POST /campaigns/1/battles/5/decline/"));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Battle Status" })).not.toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Decline battle" })).not.toBeInTheDocument()
    );
  });

  it("takes the invite out of the bell once declined on the overview (BUG-45)", async () => {
    const user = setupUser();
    fakeApi.on("GET /notifications/", [
      {
        id: 32,
        notification_type: "battle_invite",
        campaign_id: 1,
        reference_id: "5",
        payload: { battle_id: 5, campaign_id: 1, title: "Ambush", created_by_user_label: "Mira" },
        created_at: "2026-10-18T10:00:00Z",
      },
    ]);
    fakeApi.on("POST /campaigns/1/battles/5/decline/", () =>
      battleState({ status: "canceled", me: { status: "declined" } })
    );
    renderWithQueryClient(
      <AppStoreProvider>
        <MemoryRouter initialEntries={["/campaigns/1"]}>
          <OverviewWithBell />
        </MemoryRouter>
      </AppStoreProvider>
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Notifications" })).toHaveTextContent("1")
    );

    await user.click(await screen.findByRole("button", { name: "See Status" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Battle Status" })).getByRole("button", {
        name: "Decline",
      })
    );
    await user.click(
      within(screen.getByRole("dialog", { name: "Decline battle" })).getByRole("button", {
        name: "Decline",
      })
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Notifications" })).not.toHaveTextContent("1")
    );
  });
});

describe("BattleActionPanel with a reported result awaiting you", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeRealtime.reset();
    fakeApi.on("GET /notifications/", [resultRequest]);
    fakeApi.on("GET /campaigns/1/battles/?open=1", [pendingResult]);
    pending = [pendingRow()];
    fakeApi.on(PENDING_ROUTE, () => pending);
  });

  it("answers a reported result from the overview's card: Approve sends approve-result/ (BUG-46)", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${resultPath("approve-result")}`, () => {
      pending = [];
      return answeredResult("ended");
    });
    const overview = await renderOverview();

    const results = await within(overview).findByRole("region", {
      name: "Results awaiting your approval",
    });
    expect(results).toHaveTextContent("Skirmish at the Market Square");
    expect(results).toHaveTextContent("Reported by Mira");
    expect(results).toHaveTextContent("Winners: Night Razors");
    expect(results).toHaveTextContent("Waiting for your answer");
    expect(within(results).queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();

    await user.click(within(results).getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(within(overview).queryByRole("region")).not.toBeInTheDocument());
    expect(fakeApi.bodyOf(`POST ${resultPath("approve-result")}`)).toBeUndefined();
    // The bell's request went with it.
    expect(screen.getByRole("button", { name: "Notifications" })).not.toHaveTextContent("1");
  });

  it("declines from the card only after saying the result is cancelled for everyone (BUG-46)", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${resultPath("decline-result")}`, () => {
      pending = [];
      return answeredResult("canceled");
    });
    await renderOverview();
    await screen.findByRole("region", { name: "Results awaiting your approval" });

    await user.click(within(card()).getByRole("button", { name: "Decline" }));
    const confirm = screen.getByRole("dialog", { name: "Decline" });
    expect(confirm).toHaveAccessibleDescription(
      "Decline this result? It is cancelled for every player and records nothing."
    );
    expect(fakeApi.calls()).not.toContain(`POST ${resultPath("decline-result")}`);
    await user.click(within(confirm).getByRole("button", { name: "Decline" }));

    await waitFor(() => expect(fakeApi.calls()).toContain(`POST ${resultPath("decline-result")}`));
    await waitFor(() => expect(screen.queryByRole("region")).not.toBeInTheDocument());
  });

  it("shows a result you just reported on the card, with Withdraw (BUG-46)", async () => {
    const user = setupUser();
    pending = [];
    fakeApi.on("POST /campaigns/1/battles/report-result/", () => {
      pending = [pendingRow({ awaiting_my_answer: false, can_withdraw: true })];
      return answeredResult("canceled");
    });
    const players = [
      {
        id: 7,
        name: "Owner",
        warband: { id: 101, name: "Iron Vultures", faction: "Reiklanders", wins: 0, losses: 0 },
      },
      {
        id: OPPONENT.id,
        name: "Mira",
        warband: {
          id: OPPONENT.warband.id,
          name: OPPONENT.warband.name,
          faction: "Skaven",
          wins: 0,
          losses: 0,
        },
      },
    ];
    renderWithQueryClient(
      <AppStoreProvider>
        <MemoryRouter initialEntries={["/campaigns/1"]}>
          <BattleActionPanel campaignId={1} players={players} campaignStarted />
        </MemoryRouter>
      </AppStoreProvider>
    );

    const start = await screen.findByRole("button", { name: "Start battle" });
    await waitFor(() => expect(start).toBeEnabled());
    await user.click(start);
    await user.click(screen.getByRole("button", { name: "Report" }));
    const dialog = screen.getByRole("dialog", { name: "Report Battle Result" });
    await user.type(
      within(dialog).getByPlaceholderText("Skirmish at the Market Square..."),
      "Ambush"
    );
    const ticks = within(dialog).getAllByRole("checkbox");
    await user.click(ticks[1]);
    await user.click(within(dialog).getByRole("checkbox", { name: "No winner" }));
    await user.click(within(dialog).getByRole("button", { name: "Submit result" }));

    const results = await screen.findByRole("region", { name: "Results awaiting approval" });
    expect(within(results).getByRole("button", { name: "Withdraw" })).toBeInTheDocument();
  });

  it("lets the submitter withdraw a result still waiting for others (BUG-46)", async () => {
    const user = setupUser();
    pending = [
      pendingRow({
        created_by_user_id: 7,
        created_by_user_label: "Owner",
        awaiting_my_answer: false,
        can_withdraw: true,
        participants: [
          {
            user_id: 7,
            user_label: "Owner",
            warband_id: 101,
            warband_name: "Iron Vultures",
            status: "reported_result_approved",
          },
          {
            user_id: OPPONENT.id,
            user_label: "Mira",
            warband_id: OPPONENT.warband.id,
            warband_name: OPPONENT.warband.name,
            status: "reported_result_pending",
          },
        ],
      }),
    ];
    fakeApi.on(`POST ${resultPath("withdraw-result")}`, () => {
      pending = [];
      return answeredResult("canceled");
    });
    await renderOverview();

    const results = await screen.findByRole("region", { name: "Results awaiting approval" });
    expect(results).toHaveTextContent("Waiting for Mira");
    expect(within(results).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    await user.click(within(results).getByRole("button", { name: "Withdraw" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Withdraw" })).getByRole("button", {
        name: "Withdraw",
      })
    );

    await waitFor(() => expect(fakeApi.calls()).toContain(`POST ${resultPath("withdraw-result")}`));
    await waitFor(() => expect(screen.queryByRole("region")).not.toBeInTheDocument());
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

  it("keeps the result to answer on the overview once the bell is cleared (BUG-46)", async () => {
    const user = setupUser();
    fakeApi.on("POST /notifications/clear-all/", { ok: true });
    const overview = await renderOverview();
    await within(overview).findByRole("region", { name: "Results awaiting your approval" });

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));

    // Clearing only resolves the notification (the server no longer declines the result).
    await waitFor(() => expect(fakeApi.calls()).toContain("POST /notifications/clear-all/"));
    expect(fakeApi.calls()).not.toContain(`POST ${resultPath("decline-result")}`);
    expect(
      within(card())
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Decline", "Approve"]);
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("dialog", { name: "Notifications" })).toHaveTextContent(
      "You are all caught up."
    );
  });
});
