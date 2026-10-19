import type {
  BattleCapabilities,
  BattleEvent,
  BattleState,
  BroadcastCapabilities,
} from "@/features/battles/types/battle-types";
import type { BattleSocketMessage } from "@/features/battles/types/battle-messages";

import { capabilityBasis } from "./battle-capabilities";
import { mergeBattleEvents, patchParticipants, stateVersion } from "./battle-cache";

/** Who reads the messages: their user id, and whether they hold `manage_battles`. */
export type BattleReader = { userId: number | undefined; managesBattles: boolean };

const NO_READER: BattleReader = { userId: undefined, managesBattles: false };

/**
 * Your flags from a broadcast: yours as a player, widened flag by flag by a battle manager's when
 * you hold `manage_battles` (every flag only widens with it); a manager not playing gets theirs.
 */
export function readerCapabilities(
  broadcast: BroadcastCapabilities,
  reader: BattleReader
): BattleCapabilities {
  const mine = reader.userId !== undefined ? broadcast.by_user[String(reader.userId)] : undefined;
  const none: BattleCapabilities = {
    start: false,
    cancel: false,
    close_postbattle: false,
    edit_record: false,
  };
  if (!reader.managesBattles) {
    return mine ?? none;
  }
  const flags: Record<string, boolean> = { ...none };
  for (const source of [mine ?? none, broadcast.manager]) {
    for (const [flag, value] of Object.entries(source)) {
      flags[flag] = Boolean(flags[flag]) || Boolean(value);
    }
  }
  return flags as BattleCapabilities;
}

/**
 * What a write's last message adds besides the snapshot: your capabilities, and once players are
 * in postbattle your suggestions and the rules (item 8), so none of them costs a read.
 */
function withBroadcastExtras(
  state: BattleState,
  message: BattleSocketMessage,
  reader: BattleReader
): BattleState {
  const capabilities = message.capabilities
    ? readerCapabilities(message.capabilities, reader)
    : null;
  const suggestion =
    reader.userId !== undefined ? message.postbattle?.suggested?.[String(reader.userId)] : null;
  return {
    ...state,
    ...(capabilities ? { capabilities, capabilitiesBasis: capabilityBasis(state) } : {}),
    ...(suggestion ? { suggested_postbattle: suggestion } : {}),
    ...(message.postbattle?.rules ? { rules: message.postbattle.rules } : {}),
  };
}

/** True when your own postbattle is open and the message couldn't carry its suggestions. */
function missesYourSuggestions(
  state: BattleState,
  message: BattleSocketMessage,
  reader: BattleReader
) {
  const you = state.participants.find((participant) => participant.user.id === reader.userId);
  return Boolean(message.postbattle_omitted) && you?.status === "finished_battle";
}

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
  message: BattleSocketMessage,
  reader: BattleReader = NO_READER
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
  const next = withBroadcastExtras(
    {
      ...base,
      battle: message.battle,
      participants: patchParticipants(cached.participants, message.participants ?? []),
    },
    message,
    reader
  );
  return { next, refetch: missesYourSuggestions(next, message, reader) ? "gap" : "none" };
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
