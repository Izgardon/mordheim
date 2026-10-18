import type { BattleEvent } from "@/features/battles/types/battle-types";

/** Events still counting: an undone kill or item use stays in the timeline, voided (BUG-11). */
const isLive = (event: BattleEvent) => !event.voided_at;

const payloadOf = (event: BattleEvent) => (event.payload_json ?? {}) as Record<string, unknown>;

/** The unit a kill event credits (`payload.killer.unit_key`). */
export function killerUnitKey(event: BattleEvent) {
  const killer = payloadOf(event).killer as { unit_key?: unknown } | undefined;
  return typeof killer?.unit_key === "string" ? killer.unit_key : null;
}

/** A unit's kills that still count, oldest first; only the actor can undo his own. */
export function liveKillEvents(events: BattleEvent[], unitKey: string, actorUserId?: number) {
  return events.filter(
    (event) =>
      event.type === "unit_kill_recorded" &&
      isLive(event) &&
      killerUnitKey(event) === unitKey &&
      (actorUserId === undefined || event.actor_user_id === actorUserId)
  );
}

/** How many of each single-use item each unit has used, leaving out undone uses. */
export function usedSingleUseItemCounts(events: BattleEvent[]) {
  const counts: Record<string, Record<number, number>> = {};
  for (const event of events) {
    if (event.type !== "item_used" || !isLive(event)) {
      continue;
    }
    const payload = payloadOf(event);
    const unitKey = typeof payload.unit_key === "string" ? payload.unit_key.trim() : "";
    const itemId = Number(payload.item_id);
    if (!unitKey || !Number.isFinite(itemId) || itemId <= 0) {
      continue;
    }
    counts[unitKey] = counts[unitKey] ?? {};
    counts[unitKey][itemId] = (counts[unitKey][itemId] ?? 0) + 1;
  }
  return counts;
}

/** The latest use of an item by a unit that still counts and that this player can undo. */
export function latestItemUseEvent(
  events: BattleEvent[],
  unitKey: string,
  itemId: number,
  actorUserId?: number
) {
  return (
    [...events]
      .reverse()
      .find(
        (event) =>
          event.type === "item_used" &&
          isLive(event) &&
          payloadOf(event).unit_key === unitKey &&
          Number(payloadOf(event).item_id) === itemId &&
          event.actor_user_id === actorUserId
      ) ?? null
  );
}

/** The newest event of a type the actor added in an answer (the kill or item use just made). */
export function newestOwnEvent(
  events: BattleEvent[],
  type: BattleEvent["type"],
  actorUserId?: number
) {
  return (
    [...events]
      .reverse()
      .find((event) => event.type === type && event.actor_user_id === actorUserId) ?? null
  );
}
