import { promoteWarbandHenchman } from "../../api/warbands-api";
import { resolveHenchmanFromGroup } from "../../utils/levelup-utils";

import type { PromoteHenchmanResult } from "../../api/warbands-henchmen";
import type { HenchmenGroup } from "../../types/warband-types";

type PromoteHenchmanInput = {
  warbandId: number;
  group: HenchmenGroup;
  selectedHenchmanId: string;
  /** At the hero cap: the hero dismissed in the same transaction to make room. */
  dismissHeroId?: number;
  /** The skill lists he takes, from the heroes' (the server's offer). */
  skillLists: string[];
};

/**
 * Lad's Got Talent in one request (decision 9, BUG-28): `promote/` makes the hero with an advance
 * to take later and takes the member out of the group, all or nothing; the group keeps its
 * level-up for the rest of it to roll again.
 */
export async function promoteHenchman({
  warbandId,
  group,
  selectedHenchmanId,
  dismissHeroId,
  skillLists,
}: PromoteHenchmanInput): Promise<PromoteHenchmanResult | "not-found"> {
  const resolved = resolveHenchmanFromGroup(group, selectedHenchmanId);
  if (!resolved?.henchman.id) {
    return "not-found";
  }
  return promoteWarbandHenchman(warbandId, group.id, {
    henchman_id: resolved.henchman.id,
    skill_lists: skillLists,
    ...(dismissHeroId !== undefined ? { dismiss_hero_id: dismissHeroId } : {}),
  });
}
