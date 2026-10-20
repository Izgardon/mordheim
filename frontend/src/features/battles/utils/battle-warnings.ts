import { toast } from "sonner";

/**
 * What a battle write went ahead despite (a guide, not a gatekeeper): a busy player, a re-roll,
 * an unusual number, a unit that left the warband. Only the acting player's answer carries them.
 */
export type BattleWarning = {
  code: string;
  message: string;
  user_id?: number;
  unit_key?: string;
  [field: string]: unknown;
};

/** Shows each warning as a toast; the write itself went through. */
export function toastBattleWarnings(warnings: BattleWarning[] | undefined) {
  for (const warning of warnings ?? []) {
    toast.warning(warning.message, {
      id: `battle-warning-${warning.code}-${warning.user_id ?? warning.unit_key ?? ""}`,
    });
  }
}
