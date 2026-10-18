/**
 * How the battle pages keep their state: one full `state/` read on mount, then each socket message
 * (the server leaves out this tab's own) patches the cached state from its snapshot, with a read
 * only on a version gap, one at a time (PERF-34). Messages without a version read as before.
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
  opponentParticipant,
  socketMessage,
  statePath,
  stateUpdatedMessage,
  versionedMessage,
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

const opponentUnit = (state: BattleState | null) =>
  state?.participants.find((entry) => entry.user.id === OPPONENT.id)?.unit_information_json[
    "hero:2"
  ];

const versioned = (version: number) =>
  battleState({ state_version: version, events: [firstEvent] });

const opponentKill = (id: number) => battleEvent(id, "unit_kill_recorded", OPPONENT.id);

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

  it("patches the state from each message's snapshot and reads nothing (PERF-34, BATL-TEST-21)", async () => {
    const { result } = await renderLoaded(versioned(1));

    for (let version = 2; version <= 6; version += 1) {
      const killCount = version - 1;
      emit(
        versionedMessage(opponentKill(version + 2), version, {
          participants: [
            opponentParticipant({ unit_information_json: { "hero:2": { kill_count: killCount } } }),
          ],
        })
      );
    }

    expect(fakeApi.calls()).toEqual([]);
    expect(result.current.battleState?.battle.state_version).toBe(6);
    expect(result.current.battleState?.events.map((event) => event.id)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(opponentUnit(result.current.battleState)?.kill_count).toBe(5);
  });

  it("applies a battle_state_updated snapshot without reading state/ (PERF-34)", async () => {
    const { result } = await renderLoaded(versioned(1));

    emit(
      versionedMessage(null, 2, {
        participants: [
          opponentParticipant({ unit_information_json: { "hero:2": { current_wounds: 0 } } }),
        ],
      })
    );

    expect(fakeApi.calls()).toEqual([]);
    expect(opponentUnit(result.current.battleState)?.current_wounds).toBe(0);
    expect(result.current.battleState?.battle.state_version).toBe(2);
  });

  it("reads state/ on a version gap, one read at a time, then once more for what came meanwhile (PERF-34)", async () => {
    const { result } = await renderLoaded(versioned(1));
    const firstRead = deferred<BattleState>();
    fakeApi.on(`GET ${statePath("active", 3)}`, () => firstRead.promise);
    fakeApi.on(`GET ${statePath("active", 6)}`, battleState({ state_version: 4, events: [] }));

    // Version 2 never arrived: the cache can't be patched from 3 or 4.
    emit(versionedMessage(opponentKill(5), 3, { participants: [opponentParticipant()] }));
    emit(versionedMessage(opponentKill(6), 4, { participants: [opponentParticipant()] }));
    expect(fakeApi.calls()).toEqual([`GET ${statePath("active", 3)}`]);

    await act(async () =>
      firstRead.resolve(
        battleState({
          state_version: 4,
          events: [opponentKill(4), opponentKill(5), opponentKill(6)],
        })
      )
    );

    await waitFor(() =>
      expect(fakeApi.calls()).toEqual([
        `GET ${statePath("active", 3)}`,
        `GET ${statePath("active", 6)}`,
      ])
    );
    expect(result.current.battleState?.battle.state_version).toBe(4);
    expect(result.current.battleState?.events.map((event) => event.id)).toEqual([3, 4, 5, 6]);
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

  it("keeps what a newer answer applied when a slower, older read lands (BUG-44)", async () => {
    const { result } = await renderLoaded(versioned(1));
    const slowRead = deferred<BattleState>();
    fakeApi.on(`GET ${statePath("active", 3)}`, () => slowRead.promise);

    // A version gap starts a read; the server answers it before your kill lands.
    emit(versionedMessage(battleEvent(4, "unit_ooa_set", OPPONENT.id), 3));
    // Your kill's answer (version 4) arrives first and is applied.
    act(() =>
      result.current.applyBattleResponse(
        battleState({
          state_version: 4,
          me: { unit_information_json: { "hero:1": { kill_count: 1 } } },
          events: [firstEvent, battleEvent(5, "unit_kill_recorded", ME.id)],
        })
      )
    );
    expect(killCountOf(result.current.battleState)).toBe(1);

    await act(async () => {
      slowRead.resolve(
        battleState({ state_version: 3, events: [battleEvent(4, "unit_ooa_set", OPPONENT.id)] })
      );
    });

    // The older read's participants are dropped; its event joins the timeline.
    expect(killCountOf(result.current.battleState)).toBe(1);
    expect(result.current.battleState?.battle.state_version).toBe(4);
    expect(result.current.battleState?.events.map((event) => event.id)).toEqual([3, 4, 5]);
  });
});
