import type { BattleEvent, BattleState } from "@/features/battles/types/battle-types";

function dedupeBattleEvents(events: BattleEvent[]) {
  const byId = new Map<number, BattleEvent>();
  for (const event of events) {
    byId.set(event.id, event);
  }
  return Array.from(byId.values()).sort((left, right) => left.id - right.id);
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
