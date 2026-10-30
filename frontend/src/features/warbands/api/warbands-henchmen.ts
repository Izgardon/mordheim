import { apiRequest } from "@/lib/api-client";

import type { HenchmenGroup, WarbandHero, WarbandUnitsSummary } from "../types/warband-types";
import type { LevelUpRollData } from "../utils/levelup-utils";

/** Lad's Got Talent (decision 9): the member, the hero's advance, and a hero to make room. */
export type PromoteHenchmanBody = {
  henchman_id: number;
  advance: { id: string; label?: string };
  roll1?: LevelUpRollData;
  roll2?: LevelUpRollData;
  dismiss_hero_id?: number;
};

/** The new hero, the group without him (null when he was the last), and the new summary. */
export type PromoteHenchmanResult = {
  hero: WarbandHero;
  group: HenchmenGroup | null;
  summary: WarbandUnitsSummary;
};

/** One transaction: the hero, his advance, the group's spent level-up and his departure. */
export const promoteWarbandHenchman = (
  warbandId: number,
  groupId: number,
  body: PromoteHenchmanBody
) =>
  apiRequest<PromoteHenchmanResult>(`/warbands/${warbandId}/henchmen-groups/${groupId}/promote/`, {
    method: "POST",
    body,
  });
