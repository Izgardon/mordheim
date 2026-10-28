import {
  buildGold,
  buildInjuries,
  buildItemsLost,
  buildItemsUsed,
  buildLevelUps,
} from "@/features/battles/components/postbattle/finalise-changes";
import type { PostbattleRenderableGroup } from "@/features/battles/components/postbattle/postbattle-utils";
import { paysUpkeep } from "@/features/battles/components/postbattle/upkeep-rules";
import type { StatChangeRow } from "@/features/battles/components/postbattle/stat-changes";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type {
  BattleEvent,
  BattlePostbattleState,
  BattlePostbattleSuggestion,
} from "@/features/battles/types/battle-types";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";

export type UpkeepRow = {
  unitKey: string;
  unitName: string;
  unitType: string;
  cost: number | null;
  /** An upkeep formula ("1 piece of wyrdstone"): owed besides the gold, as a reminder. */
  costExpression: string | null;
  hasFixedCost: boolean;
  dead: boolean;
};

/**
 * One upkeep row per hireling who owes upkeep (not one who stays for one battle), with the draft's
 * cost, the suggestion's formula (or the roster's) and whether he is marked dead.
 */
export function buildUpkeepRows(
  draft: BattlePostbattleState | null,
  roster: ParticipantRoster | undefined
): UpkeepRow[] {
  if (!draft || !roster) {
    return [];
  }
  return roster.hirelings.filter(paysUpkeep).map((hireling) => {
    const savedEntry = draft.upkeep.entries[hireling.key];
    return {
      unitKey: hireling.key,
      unitName: savedEntry?.unit_name ?? hireling.displayName,
      unitType: hireling.unitType,
      cost: typeof savedEntry?.cost === "number" ? savedEntry.cost : null,
      costExpression: savedEntry?.cost_expression || hireling.upkeepCostExpression || null,
      hasFixedCost: typeof hireling.upkeepPrice === "number",
      dead: Boolean(draft.unit_results[hireling.key]?.dead),
    };
  });
}

/**
 * Whether a hireling the server suggested should leave has left: dismissed (from the Leaving
 * section, now or before a reload), so the warband's sheet no longer has him. Without the sheet,
 * he hasn't.
 */
export function hasLeft(hirelingId: number | null, sheet: WarbandSheet | undefined) {
  return (
    Boolean(sheet && hirelingId !== null) &&
    !sheet!.hirelings.some((unit) => unit.id === hirelingId)
  );
}

/**
 * The mounts the draft says died (step 5), as finalise removes them: a rider marked dead keeps his
 * with his items (a henchman's share takes his ridden copy), so his mount isn't listed twice.
 */
function buildMountsLost(
  draft: BattlePostbattleState | null,
  suggestion: BattlePostbattleSuggestion | undefined,
  rows: PostbattleRenderableGroup["rows"]
) {
  const atRisk = suggestion?.mount_survival?.entries ?? {};
  const diedHere = (unitKey: string) => rows.some((row) => row.unitKey === unitKey && row.dead);
  return Object.entries(draft?.mount_survival ?? {})
    .filter(([unitKey, entry]) => entry.dead && atRisk[unitKey] && !diedHere(unitKey))
    .map(([unitKey]) => ({
      unitKey,
      unitName: atRisk[unitKey].unit_name,
      mount: atRisk[unitKey].mount,
    }));
}

/**
 * Every permanent change finalising applies, as the finalise dialog lists it (BATL-NEW-10) and
 * the skip dialog lists what won't be applied. `victimsByUnitKey` is each unit's kill list (who
 * it took out), the number finalise applies (BATL-NEW-06). A unit that has left the warband
 * (`leftUnitKeys`: a dismissed hireling) gets nothing: finalise leaves its results out.
 */
export function buildFinalizeSummary({
  groups,
  draft,
  victimsByUnitKey,
  statChangeRows,
  events,
  userId,
  roster,
  sheet,
  campaign,
  suggestion,
  resourceAmount,
  resourceName,
  upkeepRows,
  upkeepTotal,
  leftUnitKeys = [],
}: {
  groups: PostbattleRenderableGroup[];
  draft: BattlePostbattleState | null;
  victimsByUnitKey: Record<string, string[]>;
  statChangeRows: StatChangeRow[];
  events: BattleEvent[];
  userId: number | undefined;
  roster: ParticipantRoster | undefined;
  sheet: WarbandSheet | undefined;
  campaign: Pick<CampaignSummary, "hero_level_thresholds" | "henchmen_level_thresholds"> | null;
  /** The server's suggestions: their `level_ups` count where the XP wasn't changed. */
  suggestion?: BattlePostbattleSuggestion;
  resourceAmount: number;
  resourceName: string | null;
  upkeepRows: UpkeepRow[];
  upkeepTotal: number;
  /** Units that have left the warband since the battle began (dismissed hirelings). */
  leftUnitKeys?: string[];
}) {
  const stays = (unitKey: string) => !leftUnitKeys.includes(unitKey);
  const rows = groups.flatMap((group) => group.rows).filter((row) => stays(row.unitKey));
  const statChanges = statChangeRows.filter((row) => row.unitKeys.some(stays));
  const xpRows = rows.filter((row) => row.canGainXp && row.xpEarned > 0);
  const payUpkeep = Boolean(draft?.upkeep.pay_upkeep);
  const findsGoldCrowns = draft?.finds.gold_crowns ?? 0;
  return {
    deaths: rows.filter((row) => row.dead),
    itemsLost: buildItemsLost(rows, roster),
    mountsLost: buildMountsLost(draft, suggestion, rows),
    injuries: buildInjuries(rows),
    xpAwards: xpRows.map((row) => ({
      unitKey: row.unitKey,
      unitName: row.unitName,
      xpEarned: row.xpEarned,
    })),
    levelUps: buildLevelUps(xpRows, sheet, campaign, suggestion?.unit_results),
    keptStatChanges: statChanges.filter((row) => row.kept),
    droppedStatChanges: statChanges.filter((row) => !row.kept),
    itemsUsed: buildItemsUsed(events, userId, roster),
    gold: buildGold({ sheet, findsGoldCrowns, upkeepPaid: payUpkeep ? upkeepTotal : 0 }),
    kills: rows
      .map((row) => ({
        unitKey: row.unitKey,
        unitName: row.unitName,
        victims: victimsByUnitKey[row.unitKey] ?? [],
      }))
      .filter((row) => row.victims.length > 0),
    findsGoldCrowns,
    findsItems: draft?.finds.items ?? [],
    resourceAmount,
    resourceName,
    upkeepRows: upkeepRows.filter(
      (row) => !row.dead && typeof row.cost === "number" && stays(row.unitKey)
    ),
    upkeepTotal,
    payUpkeep,
  };
}

export type FinalizeSummary = ReturnType<typeof buildFinalizeSummary>;
