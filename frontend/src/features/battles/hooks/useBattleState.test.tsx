/**
 * How a battle page keeps its state: one full `state/` read on mount, then one more read for every
 * socket event it hears (the server leaves out this tab's own). Characterised before PR B moves
 * battle state into TanStack.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { notifyManager } from "@tanstack/react-query";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BATTLE_CHANNEL,
  BATTLE_ID,
  CAMPAIGN_ID,
  ME,
  OPPONENT,
  battleEvent,
  battleState,
  deferred,
  socketMessage,
  statePath,
  stateUpdatedMessage,
} from "@/test/battle-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { createQueryWrapper } from "@/test/query-test-utils";
import type { BattleState } from "../types/battle-types";
import { useBattleState } from "./useBattleState";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);

// The state is a TanStack query: tell the hook about cache changes at once, inside `act`, rather
// than on TanStack's timer.
beforeAll(() => notifyManager.setScheduler((callback) => callback()));
afterAll(() => notifyManager.setScheduler((callback) => setTimeout(callback, 0)));

const firstEvent = battleEvent(3, "battle_started", ME.id);

const renderBattleState = () =>
  renderHook(
    () =>
      useBattleState({
        campaignId: CAMPAIGN_ID,
        battleId: BATTLE_ID,
        view: "active",
      }),
    { wrapper: createQueryWrapper() }
  );

/** Renders the hook and waits for its first full read (`sinceEventId=0`). */
async function renderLoaded(initial: BattleState = battleState({ events: [firstEvent] })) {
  fakeApi.on(`GET ${statePath("active")}`, initial);
  const hook = renderBattleState();
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  fakeApi.clearRequests();
  return hook;
}

const emit = (message: unknown) =>
  act(() => fakeRealtime.emit(BATTLE_CHANNEL, "battle.event", message));

const killCountOf = (state: BattleState | null) =>
  state?.participants.find((entry) => entry.user.id === ME.id)?.unit_information_json["hero:1"]
    ?.kill_count;

describe("useBattleState", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeRealtime.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the whole state once and listens on the battle channel", async () => {
    const { result } = await renderLoaded();

    expect(result.current.battleState?.battle.status).toBe("active");
    expect(result.current.lastEventIdRef.current).toBe(3);
    expect(fakeRealtime.subscriberCount(BATTLE_CHANNEL)).toBe(1);
  });

  it("GETs state/ again for every event another user sends, with no coalescing (PERF-34, pinned; flips in PR B)", async () => {
    await renderLoaded();
    // The reads never answer, so each event starts its own, all from the same last event id.
    for (let id = 4; id <= 8; id += 1) {
      emit(socketMessage(battleEvent(id, "unit_kill_recorded", OPPONENT.id)));
    }

    expect(fakeApi.calls()).toEqual(Array(5).fill(`GET ${statePath("active", 3)}`));
  });

  it("refetches for a bare battle_state_updated too: the event carries no state (PERF-34, pinned; flips in PR B)", async () => {
    await renderLoaded();

    emit(stateUpdatedMessage("active", OPPONENT.id));

    expect(fakeApi.calls()).toEqual([`GET ${statePath("active", 3)}`]);
  });

  it("reads state for your own user's events too, so your other tab or device updates (BUG-75)", async () => {
    await renderLoaded();

    // Sent from your phone: the server left only the phone's socket out, so this tab hears them.
    emit(socketMessage(battleEvent(4, "unit_kill_recorded", ME.id)));
    emit(stateUpdatedMessage("active", ME.id));

    expect(fakeApi.calls()).toEqual([
      `GET ${statePath("active", 3)}`,
      `GET ${statePath("active", 3)}`,
    ]);
  });

  it("refetches nothing when the connection comes back or the tab is shown again (BUG-19, BATL-TEST-22, pinned; flips in PR B)", async () => {
    const { result } = await renderLoaded();
    // Meanwhile the battle ended on the server.
    fakeApi.on(`GET ${statePath("active", 3)}`, battleState({ status: "postbattle" }));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

    act(() => {
      fakeRealtime.restoreConnection();
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    expect(fakeApi.calls()).toEqual([]);
    expect(result.current.battleState?.battle.status).toBe("active");
  });

  it("lets a slow read take back participants a newer answer already applied (BUG-44, pinned; flips in PR B)", async () => {
    const { result } = await renderLoaded();
    const slowRead = deferred<BattleState>();
    fakeApi.on(`GET ${statePath("active", 3)}`, () => slowRead.promise);

    // Another player's event starts a read; the server answers it before your kill lands.
    emit(socketMessage(battleEvent(4, "unit_ooa_set", OPPONENT.id)));
    // Your kill's answer arrives first and is applied.
    act(() =>
      result.current.applyBattleResponse(
        battleState({
          me: { unit_information_json: { "hero:1": { kill_count: 1 } } },
          events: [firstEvent, battleEvent(5, "unit_kill_recorded", ME.id)],
        })
      )
    );
    expect(killCountOf(result.current.battleState)).toBe(1);

    await act(async () => {
      slowRead.resolve(battleState({ events: [battleEvent(4, "unit_ooa_set", OPPONENT.id)] }));
    });

    // The older participants replace the newer ones; the events are merged.
    expect(killCountOf(result.current.battleState)).toBeUndefined();
    expect(result.current.battleState?.events.map((event) => event.id)).toEqual([3, 4, 5]);
  });
});
