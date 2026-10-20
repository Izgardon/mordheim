import type { BattleCapabilities, BattleState } from "@/features/battles/types/battle-types";

/**
 * The battle controls follow the server's `capabilities` (start, end, cancel, close postbattle),
 * which only `state/` reads carry. They describe the battle as it was read, so they are tied to
 * the battle's and participants' statuses at that read: once a write or a message moves either on,
 * they are stale (every control off) until the next read, which the battle layout asks for.
 */
export function capabilityBasis(state: Pick<BattleState, "battle" | "participants">) {
  const statuses = state.participants
    .map((participant) => `${participant.id}:${participant.status}`)
    .sort();
  return [state.battle.status, ...statuses].join("|");
}

const NONE: BattleCapabilities = {
  start: false,
  end: false,
  cancel: false,
  close_postbattle: false,
  edit_record: false,
};

/**
 * The capabilities to gate the controls with: the server's while they fit the cached battle; none
 * while stale (`stale`: read again); null when the server sent none (the pages' own rules apply).
 */
export function readCapabilities(state: BattleState): {
  capabilities: BattleCapabilities | null;
  stale: boolean;
} {
  if (!state.capabilities) {
    return { capabilities: null, stale: false };
  }
  if (state.capabilitiesBasis !== capabilityBasis(state)) {
    return { capabilities: NONE, stale: true };
  }
  return { capabilities: state.capabilities, stale: false };
}
