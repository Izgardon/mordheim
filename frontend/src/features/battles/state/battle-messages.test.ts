import { describe, expect, it, vi } from "vitest";

import type { BattleSocketMessage } from "@/features/battles/types/battle-messages";
import {
  OPPONENT,
  battleEvent,
  battleState,
  deferred,
  opponentParticipant,
  socketMessage,
  versionedMessage,
} from "@/test/battle-fixtures";

import { createSingleFlight, reconcileBattleMessage } from "./battle-messages";

const message = (value: unknown) => value as BattleSocketMessage;

const cachedAt = (version: number) =>
  battleState({ state_version: version, events: [battleEvent(3, "battle_started", 7)] });

const kill = (id: number) => battleEvent(id, "unit_kill_recorded", OPPONENT.id);

const opponentKills = (count: number) =>
  opponentParticipant({ unit_information_json: { "hero:2": { kill_count: count } } });

describe("reconcileBattleMessage", () => {
  it("patches the next version from its snapshot: battle, changed participants, event", () => {
    const outcome = reconcileBattleMessage(
      cachedAt(4),
      message(versionedMessage(kill(4), 5, { participants: [opponentKills(1)] }))
    );

    expect(outcome.refetch).toBe("none");
    expect(outcome.next?.battle.state_version).toBe(5);
    expect(outcome.next?.events.map((event) => event.id)).toEqual([3, 4]);
    expect(outcome.next?.participants.map((entry) => entry.id)).toEqual([21, 22]);
    expect(outcome.next?.participants[1].unit_information_json["hero:2"]?.kill_count).toBe(1);
  });

  it("applies a battle_state_updated snapshot without adding an event", () => {
    const outcome = reconcileBattleMessage(
      cachedAt(4),
      message(versionedMessage(null, 5, { status: "postbattle", participants: [opponentKills(0)] }))
    );

    expect(outcome).toMatchObject({ refetch: "none" });
    expect(outcome.next?.battle.status).toBe("postbattle");
    expect(outcome.next?.events.map((event) => event.id)).toEqual([3]);
  });

  it("adds an earlier message's event and waits for the write's last message", () => {
    const cached = cachedAt(4);
    const first = reconcileBattleMessage(cached, message(versionedMessage(kill(4), 5)));
    expect(first.refetch).toBe("none");
    expect(first.next?.battle.state_version).toBe(4);
    expect(first.next?.events.map((event) => event.id)).toEqual([3, 4]);

    const last = reconcileBattleMessage(
      first.next,
      message(versionedMessage(kill(5), 5, { participants: [opponentKills(2)] }))
    );
    expect(last.next?.battle.state_version).toBe(5);
    expect(last.next?.events.map((event) => event.id)).toEqual([3, 4, 5]);
  });

  it("reads state/ on a version gap, an omitted snapshot or an empty cache", () => {
    expect(reconcileBattleMessage(cachedAt(4), message(versionedMessage(kill(4), 6)))).toEqual({
      next: null,
      refetch: "gap",
    });
    const omitted = reconcileBattleMessage(
      cachedAt(4),
      message(versionedMessage(kill(4), 5, { snapshotOmitted: true }))
    );
    expect(omitted.refetch).toBe("gap");
    expect(omitted.next?.events.map((event) => event.id)).toEqual([3, 4]);
    expect(reconcileBattleMessage(null, message(versionedMessage(kill(4), 5)))).toEqual({
      next: null,
      refetch: "gap",
    });
  });

  it("keeps a newer cache's participants for an older message, adding only a missing event", () => {
    const cached = cachedAt(6);
    const outcome = reconcileBattleMessage(
      cached,
      message(versionedMessage(kill(4), 5, { participants: [opponentKills(9)] }))
    );

    expect(outcome.refetch).toBe("none");
    expect(outcome.next?.battle.state_version).toBe(6);
    expect(outcome.next?.participants).toBe(cached.participants);
    expect(outcome.next?.events.map((event) => event.id)).toEqual([3, 4]);
    // Already in the timeline: nothing to change.
    expect(
      reconcileBattleMessage(
        cached,
        message(versionedMessage(battleEvent(3, "battle_started", 7), 5))
      )
    ).toEqual({ next: null, refetch: "none" });
  });

  it("reads state/ as before for a message without a version (an older server)", () => {
    expect(reconcileBattleMessage(cachedAt(4), message(socketMessage(kill(4))))).toEqual({
      next: null,
      refetch: "legacy",
    });
  });
});

describe("createSingleFlight", () => {
  it("keeps one read in flight and reads once more after it for any news meanwhile", async () => {
    const reads: Array<ReturnType<typeof deferred<void>>> = [];
    const run = vi.fn(() => {
      const read = deferred<void>();
      reads.push(read);
      return read.promise;
    });
    const flight = createSingleFlight(run);

    flight.request();
    flight.request();
    flight.request();
    expect(run).toHaveBeenCalledTimes(1);

    reads[0].resolve();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    reads[1].resolve();
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("joins a read someone else started and reads once more after it", async () => {
    const first = deferred<void>();
    const run = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const flight = createSingleFlight(run, () => true);

    flight.request();
    expect(run).toHaveBeenCalledTimes(1);
    first.resolve();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
  });

  it("carries on after a failed read", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const flight = createSingleFlight(run);

    flight.request();
    flight.request();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
  });
});
