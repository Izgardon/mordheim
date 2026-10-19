import { toast } from "sonner";

import type { BattleEvent, BattleState } from "@/features/battles/types/battle-types";

const latest = (events: BattleEvent[], type: BattleEvent["type"]) =>
  [...events].reverse().find((event) => event.type === type);

/**
 * What to tell a player whose battle page closes because the battle ended or was cancelled
 * (BATL-NEW-08), from its last `battle_ended` or `battle_canceled` event: who cancelled it, or
 * whether postbattle was closed or ran out of time. Null while the battle is still open.
 */
export function battleOverMessage(state: BattleState, userId: number | undefined) {
  const { battle, participants, events } = state;
  const title = battle.scenario?.trim() || `Battle #${battle.id}`;
  if (battle.status === "ended") {
    const mode = latest(events, "battle_ended")?.payload_json?.mode;
    if (mode === "closed") return `Postbattle was closed: ${title} has ended.`;
    if (mode === "expired") return `Postbattle ran out of time: ${title} has ended.`;
    return `${title} has ended.`;
  }
  if (battle.status === "canceled") {
    const payload = latest(events, "battle_canceled")?.payload_json ?? {};
    if (payload.mode === "declined" || payload.mode === "participants_left") {
      return `${title} was cancelled: fewer than two players are left.`;
    }
    const byUserId = Number(payload.canceled_by_user_id);
    if (byUserId === userId) return `You cancelled ${title}.`;
    const by = participants.find((participant) => participant.user.id === byUserId);
    return by ? `${by.user.label} cancelled ${title}.` : `${title} was cancelled.`;
  }
  return null;
}

/** Toasts `battleOverMessage` once per battle. */
export function toastBattleOver(state: BattleState, userId: number | undefined) {
  const message = battleOverMessage(state, userId);
  if (message) {
    toast(message, { id: `battle-over-${state.battle.id}` });
  }
}
