import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

import type { ServerWarning } from "../types/companion-types";
import type {
  HenchmenGroup,
  WarbandHero,
  WarbandItemSummary,
  WarbandUnitsSummary,
} from "../types/warband-types";
/**
 * Lad's Got Talent (decision 9): the member who joins the heroes, a hero to make room, and the
 * skill lists he takes from the heroes' (William, 27 Nov 2026).
 */
export type PromoteHenchmanBody = {
  henchman_id: number;
  dismiss_hero_id?: number;
  skill_lists: string[];
};

/** The new hero, the group without him (null when he was the last), the summary and the warnings. */
export type PromoteHenchmanResult = {
  hero: WarbandHero;
  group: HenchmenGroup | null;
  summary: WarbandUnitsSummary;
  warnings: ServerWarning[];
};

/** The skill lists the warband's heroes hold, and how many he picks (two, or fewer when they hold fewer). */
export type TalentSkillLists = { skill_lists: string[]; pick: number };

/** What the promotion offers, read afresh each time the lad's got talent comes up (the server's offer). */
export const talentSkillListsQuery = (campaignId: number, warbandId: number, groupId: number) => ({
  queryKey: queryKeys.campaign.talentSkillLists(campaignId, warbandId),
  staleTime: 0,
  queryFn: () =>
    apiRequest<TalentSkillLists>(`/warbands/${warbandId}/henchmen-groups/${groupId}/promote/`),
});

/**
 * One transaction: the hero, with an advance to take later, and his departure; the group keeps its
 * level-up for the rest of it to roll again, which can't come up the talent (`talent_used`).
 */
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
