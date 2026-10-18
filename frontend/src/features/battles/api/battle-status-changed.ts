import { ApiError } from "@/lib/api-client";
import { apiErrorCode } from "@/lib/get-error-message";

type Listener = (campaignId: number, battleId: number) => void;

const listeners = new Set<Listener>();

/**
 * Runs `listener` when a battle write is refused because the battle moved on without this tab
 * (BUG-19: `400 {code: "battle_status_changed"}`, e.g. a phone that slept through End battle).
 * Returns the unsubscribe.
 */
export function onBattleStatusChanged(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-throws a battle write's error, first telling the listeners if the battle moved on. */
export function rethrowBattleWriteError(
  error: unknown,
  campaignId: number,
  battleId: number
): never {
  if (
    error instanceof ApiError &&
    error.status === 400 &&
    apiErrorCode(error) === "battle_status_changed"
  ) {
    for (const listener of [...listeners]) {
      listener(campaignId, battleId);
    }
  }
  throw error;
}
