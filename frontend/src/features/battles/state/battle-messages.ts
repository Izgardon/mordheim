import type { BattleEvent, BattleState } from "@/features/battles/types/battle-types";
import type { BattleSocketMessage } from "@/features/battles/types/battle-messages";

import { mergeBattleEvents, patchParticipants, stateVersion } from "./battle-cache";

/**
 * What a battle socket message does to the cached state (PERF-34):
 * - `next`: the patched state to cache, when the message changes it;
 * - `refetch`: `"gap"` reads `state/` (one read at a time) because the cache can't be patched
 *   (a version was skipped, the snapshot was left out, nothing is cached yet); `"legacy"` reads it
 *   for a message without a version, as every message did before.
 */
export type BattleMessageOutcome = {
  next: BattleState | null;
  refetch: "none" | "gap" | "legacy";
};

const isEvent = (value: unknown): value is BattleEvent =>
  Boolean(value && typeof value === "object" && typeof (value as BattleEvent).id === "number");

/** The timeline event a message carries (none for `battle_state_updated`). */
function eventOf(message: BattleSocketMessage): BattleEvent | null {
  return message.type !== "battle_state_updated" && isEvent(message.payload)
    ? message.payload
    : null;
}

function withEvent(state: BattleState, event: BattleEvent | null): BattleState | null {
  if (!event || state.events.some((entry) => entry.id === event.id)) {
    return null;
  }
  return { ...state, events: mergeBattleEvents(state.events, [event]) };
}

/**
 * Patches the cache from a message when its `state_version` is the cached one plus one, or equal
 * (the later messages of one write); reads `state/` on a gap. A message older than the cache
 * changes only the timeline (its event may still be missing from it).
 */
export function reconcileBattleMessage(
  cached: BattleState | null,
  message: BattleSocketMessage
): BattleMessageOutcome {
  const version = typeof message.state_version === "number" ? message.state_version : null;
  if (version === null) {
    return { next: null, refetch: "legacy" };
  }
  const current = stateVersion(cached);
  if (!cached || current === null) {
    return { next: null, refetch: "gap" };
  }
  const event = eventOf(message);
  if (version < current) {
    return { next: withEvent(cached, event), refetch: "none" };
  }
  if (version > current + 1) {
    return { next: null, refetch: "gap" };
  }
  if (message.snapshot_omitted) {
    return { next: withEvent(cached, event), refetch: "gap" };
  }
  if (!message.battle) {
    // An earlier message of a write that added several events: the last one has the snapshot.
    return { next: withEvent(cached, event), refetch: "none" };
  }
  const base = withEvent(cached, event) ?? cached;
  return {
    next: {
      ...base,
      battle: message.battle,
      participants: patchParticipants(cached.participants, message.participants ?? []),
    },
    refetch: "none",
  };
}

/**
 * Keeps one read in flight: a request while one runs queues a single follow-up, so the news is
 * read once after the read that may predate it. `isBusy` reports a read someone else started (the
 * first load, an invalidation); a request then joins it and reads once more after.
 */
export function createSingleFlight(
  run: () => Promise<unknown>,
  isBusy: () => boolean = () => false
) {
  let inFlight = false;
  let queued = false;
  const start = () => {
    inFlight = true;
    void run()
      .catch(() => undefined)
      .finally(() => {
        inFlight = false;
        if (queued) {
          queued = false;
          start();
        }
      });
  };
  return {
    request() {
      if (inFlight) {
        queued = true;
        return;
      }
      if (isBusy()) {
        queued = true;
      }
      start();
    },
  };
}
