import type { QueryClient } from "@tanstack/react-query";

import { applyWarbandUpdate } from "@/features/warbands/api/warband-cache";
import { unitApi } from "@/features/warbands/units/unit-api";

import { toastPurchaseWarnings } from "./purchase";

/**
 * Buys an upgrade of the warband's template onto a hero on the roster (the templates plan, phase
 * 3: the store's Upgrades): the heroes' Save with one `upgrades` line, so the server links its
 * special to him and writes the Buy row at the price sent, as the hire dialog's do.
 */
export async function buyUpgrade(
  queryClient: QueryClient,
  warbandId: number,
  line: { heroId: number; upgradeId: number; price: number }
) {
  const answer = await unitApi("hero").batch(warbandId, {
    upgrades: [{ unit_id: line.heroId, upgrade_id: line.upgradeId, price: line.price }],
  });
  applyWarbandUpdate(queryClient, warbandId, { heroes: answer.units, summary: answer.summary });
  toastPurchaseWarnings(answer.warnings);
  return answer;
}
