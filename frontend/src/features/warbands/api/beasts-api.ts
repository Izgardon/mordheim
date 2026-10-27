import { apiRequest } from "@/lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";
import { UNIT_URL_SEGMENTS } from "../units/unit-api";

import type { ServerWarning } from "../types/companion-types";
import type { Unit, UnitKindKey } from "../types/units";
import type {
  HenchmenGroup,
  WarbandItemSummary,
  WarbandUnitDetail,
  WarbandUnitsSummary,
} from "../types/warband-types";

/*
 * Beasts in the warband (the bestiary rewrite, step 4): the switch that turns a mount or a pet in a
 * unit's items on for that unit, recruiting a creature's copies into henchmen, and members of a
 * creature group going back to the item. No gold moves: the beast was paid for as an item. Each
 * names this browser's socket, so the `warband.changed` it sends the other members skips it.
 */

/** The switch's answer: the unit's detail, the summary (rating changes) and its warnings. */
export type CompanionSwitchAnswer<K extends UnitKindKey> = {
  unit: Unit<K>;
  summary: WarbandUnitsSummary;
  warnings: ServerWarning[];
};

/** Switches one copy (`rowId`, the item row) on for the unit holding it, or off. */
export const switchCompanion = <K extends UnitKindKey>(
  warbandId: number,
  kind: K,
  unitId: number,
  rowId: number,
  on: boolean
) =>
  apiRequest<CompanionSwitchAnswer<K>>(
    `/warbands/${warbandId}/${UNIT_URL_SEGMENTS[kind]}/${unitId}/items/${rowId}/companion/`,
    { method: "POST", headers: socketIdHeaders(), body: { on } }
  );

/** Where recruited copies come from: the stash, or a unit of the roster holding them. */
export type RecruitSource =
  | { type: "stash"; item_id: number; cost?: number | null }
  | { type: UnitKindKey; id: number; item_id: number };

/** Where they go: a group recruited from the same beast, or a new group (name optional). */
export type RecruitTarget = { group_id: number } | { new: { name?: string } };

export type RecruitBody = { source: RecruitSource; quantity: number; target: RecruitTarget };

export type RecruitAnswer = {
  group: HenchmenGroup;
  /** The unit the copies left (its detail), or null from the stash. */
  source: WarbandUnitDetail | null;
  stash_item: WarbandItemSummary | null;
  removed_stash_item_id: number | null;
  summary: WarbandUnitsSummary;
  warnings: ServerWarning[];
};

export const recruitBeasts = (warbandId: number, body: RecruitBody) =>
  apiRequest<RecruitAnswer>(`/warbands/${warbandId}/beasts/recruit/`, {
    method: "POST",
    headers: socketIdHeaders(),
    body,
  });

export type BackToItemBody = { count: number } | { member_ids: number[] };

export type BackToItemAnswer = {
  /** The group without them, or null once its last members went (it is disbanded). */
  group: HenchmenGroup | null;
  stash_items: WarbandItemSummary[];
  summary: WarbandUnitsSummary;
};

export const sendBackToItem = (warbandId: number, groupId: number, body: BackToItemBody) =>
  apiRequest<BackToItemAnswer>(`/warbands/${warbandId}/henchmen-groups/${groupId}/back-to-item/`, {
    method: "POST",
    headers: socketIdHeaders(),
    body,
  });
