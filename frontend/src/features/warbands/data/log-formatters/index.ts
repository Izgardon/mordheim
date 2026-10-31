import { ADVANCE_FORMATTERS } from "./advance";
import { BATTLE_FORMATTERS } from "./battle";
import { ITEM_FORMATTERS } from "./items";
import { LOADOUT_FORMATTERS } from "./loadout";
import { PERSONNEL_FORMATTERS } from "./personnel";
import { TRADING_FORMATTERS } from "./trading";

import type { LogFormatter } from "./badges";

export type { LogFormatter } from "./badges";
export { renderDiceBadge, renderGoldBadge } from "./badges";

/** Every log entry with its own formatter, by `"feature:entry_type"` (others use templates). */
export const LOG_FORMATTERS: Record<string, LogFormatter> = {
  ...ADVANCE_FORMATTERS,
  ...TRADING_FORMATTERS,
  ...PERSONNEL_FORMATTERS,
  ...BATTLE_FORMATTERS,
  ...LOADOUT_FORMATTERS,
  ...ITEM_FORMATTERS,
};
