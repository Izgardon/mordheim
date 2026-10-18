import type { BattleEvent, BattleState } from "@/features/battles/types/battle-types";

const VOID_EVENT_TYPES = new Set<BattleEvent["type"]>(["unit_kill_voided", "item_used_voided"]);

/**
 * A write's answer carries only the events it added, so an undo (`unit_kill_voided`,
 * `item_used_voided`) names the event it voided rather than resending it: mark that one voided
 * here, as a full state read would show it (BUG-11).
 */
function applyVoids(events: BattleEvent[]) {
  const voidedAt = new Map<number, string>();
  for (const event of events) {
    const voidedId = Number((event.payload_json as { voided_event_id?: unknown }).voided_event_id);
    if (VOID_EVENT_TYPES.has(event.type) && Number.isFinite(voidedId)) {
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

function dedupeBattleEvents(events: BattleEvent[]) {
  const byId = new Map<number, BattleEvent>();
  for (const event of events) {
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

export function mergeBattleState(previous: BattleState | null, next: BattleState): BattleState {
  if (!previous) {
    return next;
  }

  return {
    battle: next.battle,
    participants: next.participants,
    events: dedupeBattleEvents([...(previous.events ?? []), ...(next.events ?? [])]),
  };
}
