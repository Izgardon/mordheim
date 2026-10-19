/**
 * The prebattle page's "unready when you leave" cleanup, which runs when the page unmounts and not
 * whenever the battle's or your own status changes, and its redirects once the battle moves on
 * (BUG-74).
 */
import { act, screen, waitFor, within } from "@testing-library/react";
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

  it("shows who the battle is waiting for, and how long since each player was seen (BATL-NEW-08)", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    fakeApi.on(
      `GET ${statePath("prebattle")}`,
      battleState({
        status: "prebattle",
        me: { status: "ready", last_seen_at: new Date().toISOString() },
        opponent: { status: "joined_prebattle", last_seen_at: twoDaysAgo },
      })
    );
    renderBattleRoute("prebattle");

    const strip = await screen.findByRole("region", { name: "Battle status" });
    expect(
      within(strip)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(["YouReady", "PlayerNot readyidle 2 days"]);
  });

  it("enables Start from the server's capabilities, reading them again once your ready changes them", async () => {
    const user = setupUser();
    const capabilities = (start: boolean) => ({
      start,
      end: false,
      cancel: true,
      close_postbattle: false,
      edit_record: false,
    });
    fakeApi.on(`GET ${statePath("prebattle")}`, {
      ...battleState({ status: "prebattle", opponent: { status: "ready" } }),
      capabilities: capabilities(false),
    });
    // Ready Up's answer carries no capabilities; the read after it does.
    fakeApi.on(READY_ROUTE, () =>
      battleState({
        status: "prebattle",
        me: { status: "ready" },
        opponent: { status: "ready" },
        events: [battleEvent(3, "participant_ready_set", 7)],
      })
    );
    fakeApi.on(`GET ${statePath("prebattle", 3)}`, {
      ...battleState({
        status: "prebattle",
        me: { status: "ready" },
        opponent: { status: "ready" },
      }),
      capabilities: capabilities(true),
    });
    renderBattleRoute("prebattle");
    expect(await screen.findByRole("button", { name: "Start Battle" })).toBeDisabled();
    fakeApi.clearRequests();

    await user.click(screen.getByRole("button", { name: "Ready Up" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Start Battle" })).toBeEnabled());
    expect(fakeApi.calls()).toEqual([READY_ROUTE, `GET ${statePath("prebattle", 3)}`]);
  });

  it("doesn't offer Cancel battle to the creator when the server's capabilities don't allow it", async () => {
    fakeApi.on(`GET ${statePath("prebattle")}`, {
      ...battleState({ status: "prebattle" }),
      capabilities: {
        start: false,
        end: false,
        cancel: false,
        close_postbattle: false,
        edit_record: false,
      },
    });
    renderBattleRoute("prebattle");
    expect(await screen.findByRole("button", { name: "Ready Up" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel battle" })).toBeNull();
  });

  it("sends Undo Ready once, with no second unready from the exit cleanup (BUG-74)", async () => {
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
    ]);
  });

  it("takes your ready back when you leave prebattle while ready (BUG-74)", async () => {
    fakeApi.on(
      `GET ${statePath("prebattle")}`,
      battleState({ status: "prebattle", me: { status: "ready" } })
    );
    const { unmount } = renderBattleRoute("prebattle");
    expect(await screen.findByRole("button", { name: "Undo Ready" })).toBeInTheDocument();
    expect(readyPosts()).toEqual([]);

    unmount();

    expect(readyPosts()).toEqual([
      { method: "POST", path: battlePath("ready/"), body: { ready: false } },
    ]);
  });

  it("follows another player's start to Active without sending an unready (BUG-74)", async () => {
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

    await waitFor(() =>
      expect(screen.getByLabelText("Current path")).toHaveTextContent(
        "/campaigns/1/battles/5/active"
      )
    );
    expect(fakeApi.calls()[0]).toBe(`GET ${statePath("prebattle", 3)}`);
    expect(readyPosts()).toEqual([]);
  });

  it("lets an invitee decline from the invite gate, after saying it is final (BUG-45)", async () => {
    const user = setupUser();
    fakeApi.on(
      `GET ${statePath("prebattle")}`,
      battleState({
        status: "inviting",
        created_by_user_id: OPPONENT.id,
        me: { status: "invited" },
        opponent: { status: "accepted" },
      })
    );
    fakeApi.on(`POST ${battlePath("decline/")}`, () =>
      battleState({ status: "canceled", me: { status: "declined" } })
    );
    renderBattleRoute("prebattle");

    await user.click(await screen.findByRole("button", { name: "Decline" }));
    const confirm = screen.getByRole("dialog", { name: "Decline battle" });
    expect(confirm).toHaveAccessibleDescription(
      "Decline this battle? You can't rejoin it, and with fewer than two players left it is cancelled."
    );
    expect(fakeApi.calls()).not.toContain(`POST ${battlePath("decline/")}`);
    await user.click(within(confirm).getByRole("button", { name: "Decline" }));

    expect(await screen.findByText("Campaign overview")).toBeInTheDocument();
    expect(fakeApi.requests()).toContainEqual({ method: "POST", path: battlePath("decline/") });
  });

  it("doesn't offer Decline to the battle's creator", async () => {
    fakeApi.on(
      `GET ${statePath("prebattle")}`,
      battleState({
        status: "inviting",
        me: { status: "accepted" },
        opponent: { status: "invited" },
      })
    );
    renderBattleRoute("prebattle");

    expect(
      (await screen.findAllByRole("button", { name: "Cancel battle" })).length
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
  });

  it("redirects to postbattle when the battle is already there (BUG-74)", async () => {
    fakeApi.on(`GET ${statePath("prebattle")}`, battleState({ status: "postbattle" }));
    renderBattleRoute("prebattle");

    await waitFor(() =>
      expect(screen.getByLabelText("Current path")).toHaveTextContent(
        "/campaigns/1/battles/5/postbattle"
      )
    );
    expect(screen.queryByRole("button", { name: "Ready Up" })).not.toBeInTheDocument();
  });
});
