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

/**
 * A warning's words: the server's, but a unit that left the warband is worded neutrally, with the
 * unit's name as the page has it (the server's message says "his" for anyone).
 */
export function battleWarningText(warning: BattleWarning, unitName?: string) {
  if (warning.code === "unit_left_warband" && unitName) {
    return `${unitName} has left the warband, so their results were not applied.`;
  }
  return warning.message;
}

/**
 * Shows each warning as a toast; the write itself went through. `unitName` names a warning's unit
 * by its key (finalise: the draft's names).
 */
export function toastBattleWarnings(
  warnings: BattleWarning[] | undefined,
  unitName: (unitKey: string) => string | undefined = () => undefined
) {
  for (const warning of warnings ?? []) {
    const name = warning.unit_key ? unitName(warning.unit_key) : undefined;
    toast.warning(battleWarningText(warning, name), {
      id: `battle-warning-${warning.code}-${warning.user_id ?? warning.unit_key ?? ""}`,
    });
  }
}
