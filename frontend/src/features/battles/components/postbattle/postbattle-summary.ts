import type { PostbattleRenderableGroup } from "@/features/battles/components/postbattle/postbattle-utils";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type { BattlePostbattleState } from "@/features/battles/types/battle-types";

export type UpkeepRow = {
  unitKey: string;
  unitName: string;
  unitType: string;
  cost: number | null;
  costExpression: string | null;
  hasFixedCost: boolean;
  dead: boolean;
};

/** One upkeep row per hired sword, with the draft's cost and whether he is marked dead. */
export function buildUpkeepRows(
  draft: BattlePostbattleState | null,
  roster: ParticipantRoster | undefined
): UpkeepRow[] {
  if (!draft || !roster) {
    return [];
  }
  return roster.hiredSwords.map((hiredSword) => {
    const savedEntry = draft.upkeep.entries[hiredSword.key];
    return {
      unitKey: hiredSword.key,
      unitName: savedEntry?.unit_name ?? hiredSword.displayName,
      unitType: hiredSword.unitType,
      cost: typeof savedEntry?.cost === "number" ? savedEntry.cost : null,
      costExpression: hiredSword.upkeepCostExpression ?? null,
      hasFixedCost: typeof hiredSword.upkeepPrice === "number",
      dead: Boolean(draft.unit_results[hiredSword.key]?.dead),
    };
  });
}

/** What finalising applies, as the finalise and skip dialogs list it. */
export function buildFinalizeSummary({
  groups,
  draft,
  resourceAmount,
  resourceName,
  upkeepRows,
  upkeepTotal,
}: {
  groups: PostbattleRenderableGroup[];
  draft: BattlePostbattleState | null;
  resourceAmount: number;
  resourceName: string | null;
  upkeepRows: UpkeepRow[];
  upkeepTotal: number;
}) {
  const rows = groups.flatMap((group) => group.rows);
  return {
    deaths: rows.filter((row) => row.dead),
    xpAwards: rows
      .filter((row) => row.canGainXp && row.xpEarned > 0)
      .map((row) => ({ unitKey: row.unitKey, unitName: row.unitName, xpEarned: row.xpEarned })),
    kills: rows
      .filter((row) => row.killCount > 0)
      .map((row) => ({ unitKey: row.unitKey, unitName: row.unitName, killCount: row.killCount })),
    findsGoldCrowns: draft?.finds.gold_crowns ?? 0,
    findsItems: draft?.finds.items ?? [],
    resourceAmount,
    resourceName,
    upkeepRows: upkeepRows.filter((row) => !row.dead && typeof row.cost === "number"),
    upkeepTotal,
    payUpkeep: Boolean(draft?.upkeep.pay_upkeep),
  };
}

export type FinalizeSummary = ReturnType<typeof buildFinalizeSummary>;
