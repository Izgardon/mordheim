import { ADVANCE_FORMATTERS } from "./advance";
import { BATTLE_FORMATTERS } from "./battle";
import { LOADOUT_FORMATTERS } from "./loadout";
import { PERSONNEL_FORMATTERS } from "./personnel";
import { TRADING_FORMATTERS } from "./trading";

import type { LogFormatter } from "./badges";

export type { LogFormatter } from "./badges";
export { renderDiceBadge, renderGoldBadge } from "./badges";

/** The Logs tab's badge colour per feature. */
export const FEATURE_COLORS: Record<string, string> = {
  advance: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  battle: "bg-red-500/20 text-red-300 border-red-500/30",
  loadout: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  personnel: "bg-lime-500/20 text-lime-300 border-lime-500/30",
  trading_action: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  dice_roll: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  warband: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  hero: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  campaign: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
};

export const DEFAULT_FEATURE_COLOR = "bg-white/10 text-muted-foreground border-white/20";

/** Every log entry with its own formatter, by `"feature:entry_type"` (others use templates). */
export const LOG_FORMATTERS: Record<string, LogFormatter> = {
  ...ADVANCE_FORMATTERS,
  ...TRADING_FORMATTERS,
  ...PERSONNEL_FORMATTERS,
  ...BATTLE_FORMATTERS,
  ...LOADOUT_FORMATTERS,
};
