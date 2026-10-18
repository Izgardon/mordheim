/**
 * The prebattle page's "unready when you leave" cleanup, which runs whenever the battle's or your
 * own status changes rather than only when the page unmounts (BUG-74).
 */
import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BATTLE_CHANNEL,
  OPPONENT,
  battleEvent,
  battlePath,
  battleRosters,
  battleState,
  socketMessage,
  statePath,
} from "@/test/battle-fixtures";
import { renderBattleRoute } from "@/test/battle-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "owner@example.com" } }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const READY_ROUTE = `POST ${battlePath("ready/")}`;

const readyPosts = () =>
  fakeApi.requests().filter((request) => `${request.method} ${request.path}` === READY_ROUTE);

describe("BattlePrebattle requests", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeRealtime.reset();
    fakeApi.on(`GET ${battlePath("rosters/")}`, battleRosters());
  });

  it("sends Undo Ready twice: once for the click and again from the exit cleanup (BUG-74, pinned; flips in PR A)", async () => {
    const user = setupUser();
    fakeApi.on(
      `GET ${statePath("prebattle")}`,
      battleState({ status: "prebattle", me: { status: "ready" } })
    );
    fakeApi.on(READY_ROUTE, (body: unknown) =>
      battleState({
        status: "prebattle",
        me: { status: (body as { ready: boolean }).ready ? "ready" : "joined_prebattle" },
      })
    );
    renderBattleRoute("prebattle");
    await user.click(await screen.findByRole("button", { name: "Undo Ready" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Ready Up" })).toBeEnabled());
    expect(readyPosts()).toEqual([
      { method: "POST", path: battlePath("ready/"), body: { ready: false } },
      { method: "POST", path: battlePath("ready/"), body: { ready: false } },
    ]);
  });

  it("sends an unready the server refuses when another player starts the battle (BUG-74, pinned; flips in PR A)", async () => {
    // The other player created the battle and starts it; this page hears it through the socket.
    fakeApi.on(
      `GET ${statePath("prebattle")}`,
      battleState({
        status: "prebattle",
        created_by_user_id: OPPONENT.id,
        me: { status: "ready" },
        opponent: { status: "ready" },
        events: [battleEvent(3, "participant_ready_set", OPPONENT.id)],
      })
    );
    fakeApi.on(
      `GET ${statePath("prebattle", 3)}`,
      battleState({
        status: "active",
        created_by_user_id: OPPONENT.id,
        events: [battleEvent(4, "battle_started", OPPONENT.id)],
      })
    );
    fakeApi.fail(READY_ROUTE, new Error("Battle is not in prebattle."));
    renderBattleRoute("prebattle");
    expect(await screen.findByRole("button", { name: "Undo Ready" })).toBeInTheDocument();
    fakeApi.clearRequests();

    act(() =>
      fakeRealtime.emit(
        BATTLE_CHANNEL,
        "battle.event",
        socketMessage(battleEvent(4, "battle_started", OPPONENT.id))
      )
    );

    expect(await screen.findByLabelText("Current path")).toHaveTextContent(
      "/campaigns/1/battles/5/active"
    );
    expect(fakeApi.calls().slice(0, 2)).toEqual([`GET ${statePath("prebattle", 3)}`, READY_ROUTE]);
    expect(readyPosts()).toEqual([
      { method: "POST", path: battlePath("ready/"), body: { ready: false } },
    ]);
  });

  it("stays on prebattle when the battle is already in postbattle (BUG-74, pinned; flips in PR A)", async () => {
    fakeApi.on(`GET ${statePath("prebattle")}`, battleState({ status: "postbattle" }));
    renderBattleRoute("prebattle");

    expect(await screen.findByRole("button", { name: "Ready Up" })).toBeDisabled();
    expect(screen.getByLabelText("Current path")).toHaveTextContent(
      "/campaigns/1/battles/5/prebattle"
    );
  });
});
