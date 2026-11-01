import { apiRequest } from "@/lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

import type {
  HenchmenGroup,
  WarbandHero,
  WarbandItemSummary,
  WarbandUnitsSummary,
} from "../types/warband-types";
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
    headers: socketIdHeaders(),
    body,
  });

/** A member's gap (henchmen loadouts): buy him one, take one from the stash, or leave it. */
export type GapActionBody =
  | {
      action: "buy";
      price?: number | null;
      availability_id?: number | null;
      dice_roll?: number | null;
    }
  | { action: "stash"; cost?: number | null }
  | { action: "leave" };

/** A loadout change's answer: the group, the summary, and the stash entries it touched. */
export type LoadoutAnswer = {
  unit: HenchmenGroup;
  summary: WarbandUnitsSummary;
  stash_items: WarbandItemSummary[];
  removed_stash_item_ids: number[];
};

export const actOnGap = (warbandId: number, groupId: number, gapId: number, body: GapActionBody) =>
  apiRequest<LoadoutAnswer>(`/warbands/${warbandId}/henchmen-groups/${groupId}/gaps/${gapId}/`, {
    method: "POST",
    headers: socketIdHeaders(),
    body,
  });

/** "Take Skritt's kit": one of each row he carries to the stash, and a gap for each. */
export const takeMemberKit = (warbandId: number, groupId: number, memberId: number) =>
  apiRequest<LoadoutAnswer>(
    `/warbands/${warbandId}/henchmen-groups/${groupId}/members/${memberId}/take-kit/`,
    { method: "POST", headers: socketIdHeaders() }
  );
