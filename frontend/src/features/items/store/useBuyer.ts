import { useMemo } from "react";

import { useSettingsList } from "@/features/campaigns/api/settings-queries";
import type { Warband } from "@/features/warbands/types/warband-types";

import { buyerOf, type Buyer } from "./store-items";

/**
 * The warband as "What I can buy" reads it: its types and their groups, and the names of the
 * settings in play in its campaign (`setting_ids`, always-on ones included); null without one.
 */
export function useBuyer(
  warband: Pick<Warband, "warband_type" | "counts_as"> | null | undefined,
  settingIds: number[] | undefined
): Buyer | null {
  const { data } = useSettingsList();
  return useMemo(() => {
    if (!warband) return null;
    const inPlay = (data?.settings ?? []).filter(
      (setting) => setting.always_on || (settingIds ?? []).includes(setting.id)
    );
    return buyerOf(
      warband,
      inPlay.map((setting) => setting.name)
    );
  }, [warband, data, settingIds]);
}
