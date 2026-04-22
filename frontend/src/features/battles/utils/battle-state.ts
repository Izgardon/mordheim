import type { BattleEvent, BattleState } from "@/features/battles/types/battle-types";
import type { BattleEventMessage } from "@/lib/realtime";

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

export function mergeBattleState(
  previous: BattleState | null,
  next: BattleState
): BattleState {
  if (!previous) {
    return next;
  }

  return {
    battle: next.battle,
    participants: next.participants,
    events: dedupeBattleEvents([...(previous.events ?? []), ...(next.events ?? [])]),
  };
}

function extractSocketActorUserId(message: BattleEventMessage): number | null {
  if (!message?.payload || typeof message.payload !== "object") {
    return null;
  }
  const payload = message.payload as { actor_user_id?: unknown };
  return typeof payload.actor_user_id === "number" ? payload.actor_user_id : null;
}

export function shouldIgnoreBattleSocketEvent(
  message: BattleEventMessage,
  currentUserId?: number | null
) {
  if (!currentUserId) {
    return false;
  }
  return extractSocketActorUserId(message) === currentUserId;
}
