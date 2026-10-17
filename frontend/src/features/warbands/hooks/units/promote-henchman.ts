import { promoteWarbandHenchman } from "../../api/warbands-api";
import { resolveAdvanceLabel, resolveHenchmanFromGroup } from "../../utils/levelup-utils";

import type { PromoteHenchmanResult } from "../../api/warbands-henchmen";
import type { HenchmenGroup } from "../../types/warband-types";

type PromoteHenchmanInput = {
  warbandId: number;
  group: HenchmenGroup;
  selectedHenchmanId: string;
  selectedStat: string;
  roll2d6Total: number | null;
  /** At the hero cap: the hero dismissed in the same transaction to make room. */
  dismissHeroId?: number;
};

/**
 * Lad's Got Talent in one request (decision 9, BUG-28): `promote/` makes the hero with the
 * re-rolled advance, spends the group's level-up and takes the member out of the group, all or
 * nothing.
 */
export async function promoteHenchman({
  warbandId,
  group,
  selectedHenchmanId,
  selectedStat,
  roll2d6Total,
  dismissHeroId,
}: PromoteHenchmanInput): Promise<PromoteHenchmanResult | "not-found"> {
  const resolved = resolveHenchmanFromGroup(group, selectedHenchmanId);
  if (!resolved?.henchman.id) {
    return "not-found";
  }
  return promoteWarbandHenchman(warbandId, group.id, {
    henchman_id: resolved.henchman.id,
    advance: { id: selectedStat, label: resolveAdvanceLabel(selectedStat) },
    ...(roll2d6Total !== null ? { roll1: { dice: "2d6", result: { total: roll2d6Total } } } : {}),
    ...(dismissHeroId !== undefined ? { dismiss_hero_id: dismissHeroId } : {}),
  });
}
