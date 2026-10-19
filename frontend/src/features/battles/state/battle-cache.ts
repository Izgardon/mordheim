import type {
  BattleEvent,
  BattleParticipant,
  BattleState,
} from "@/features/battles/types/battle-types";

import { capabilityBasis } from "./battle-capabilities";

/**
 * A write's answer carries only the events it added, so an undo (`unit_kill_voided`,
 * `item_used_voided`) names the event it voided rather than resending it: mark that one voided
 * here, as a full state read would show it (BUG-11).
 */
function applyVoids(events: BattleEvent[]) {
  const voidedAt = new Map<number, string>();
  for (const event of events) {
    if (event.type !== "unit_kill_voided" && event.type !== "item_used_voided") {
      continue;
    }
    const voidedId = Number(event.payload_json?.voided_event_id);
    if (Number.isFinite(voidedId)) {
      voidedAt.set(voidedId, event.created_at);
    }
  }
  if (voidedAt.size === 0) {
    return events;
  }
  return events.map((event) =>
    voidedAt.has(event.id) && !event.voided_at
      ? { ...event, voided_at: voidedAt.get(event.id) }
      : event
  );
}

/** Both timelines as one, each event once, in id order. */
export function mergeBattleEvents(previous: BattleEvent[], next: BattleEvent[]) {
  const byId = new Map<number, BattleEvent>();
  for (const event of [...previous, ...next]) {
    byId.set(event.id, event);
  }
  return applyVoids(Array.from(byId.values()).sort((left, right) => left.id - right.id));
}

export function getBattleStateLastEventId(state: BattleState | null) {
  if (!state?.events?.length) {
    return 0;
  }
  return state.events[state.events.length - 1]?.id ?? 0;
}

/** The battle's `state_version` (raised by every write others see), or null if it has none. */
export function stateVersion(state: BattleState | null | undefined) {
  const version = state?.battle.state_version;
  return typeof version === "number" ? version : null;
}

/** True when `next` is an older copy of the battle than `previous` (both carry a version). */
function isOlderThan(next: BattleState, previous: BattleState) {
  const nextVersion = stateVersion(next);
  const previousVersion = stateVersion(previous);
  return nextVersion !== null && previousVersion !== null && nextVersion < previousVersion;
}

/**
 * Merges a read's or a write's answer into the cached state: its events always join the timeline;
 * its battle and participants replace the cached ones unless the answer is older than the cache
 * (BUG-44: a slow read never takes back what a newer answer or message applied).
 */
export function mergeBattleState(previous: BattleState | null, next: BattleState): BattleState {
  // Reads carry the reader's capabilities, tied to the statuses they were read with.
  const readCapabilities = next.capabilities
    ? { capabilities: next.capabilities, capabilitiesBasis: capabilityBasis(next) }
    : null;
  if (!previous) {
    return readCapabilities ? { ...next, ...readCapabilities } : next;
  }
  const events = mergeBattleEvents(previous.events ?? [], next.events ?? []);
  const older = isOlderThan(next, previous);
  const keptCapabilities = previous.capabilities
    ? { capabilities: previous.capabilities, capabilitiesBasis: previous.capabilitiesBasis }
    : {};
  // Only postbattle reads carry the server's suggestions and rules; writes and messages don't.
  const extras = {
    ...((next.suggested_postbattle ?? previous.suggested_postbattle)
      ? { suggested_postbattle: next.suggested_postbattle ?? previous.suggested_postbattle }
      : {}),
    ...((next.rules ?? previous.rules) ? { rules: next.rules ?? previous.rules } : {}),
    ...(readCapabilities && !older ? readCapabilities : keptCapabilities),
  };
  if (older) {
    return { battle: previous.battle, participants: previous.participants, events, ...extras };
  }
  return { battle: next.battle, participants: next.participants, events, ...extras };
}

/** The cached participants with the changed ones replaced (by id) and new ones added. */
export function patchParticipants(current: BattleParticipant[], changed: BattleParticipant[]) {
  const changedById = new Map(changed.map((participant) => [participant.id, participant]));
  const patched = current.map((participant) => changedById.get(participant.id) ?? participant);
  const known = new Set(current.map((participant) => participant.id));
  return [...patched, ...changed.filter((participant) => !known.has(participant.id))];
}
