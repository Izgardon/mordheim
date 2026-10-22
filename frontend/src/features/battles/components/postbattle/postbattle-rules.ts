import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import { DEFAULT_EXPLORATION_DICE } from "@/features/battles/components/postbattle/exploration-dice";
import {
  buildLocalExplorationState,
  buildPostbattleDraft,
} from "@/features/battles/components/postbattle/postbattle-utils";
import type {
  BattleInjuryTableRow,
  BattleParticipant,
  BattlePostbattleRules,
  BattlePostbattleSeriousInjuryRoll,
  BattlePostbattleSuggestion,
} from "@/features/battles/types/battle-types";
import type { CampaignHeroDeathRoll } from "@/features/campaigns/types/campaign-types";
import type { WarbandResource } from "@/features/warbands/types/warband-types";

/**
 * Postbattle's rules and suggestions come from the server (IMP-52): `rules` and
 * `suggested_postbattle` in `state/?view=postbattle`. Without them (an older server) the page
 * still works: no exploration table (amount 0), the default dice limits, XP 0 and unknown upkeep,
 * and injury rolls flagged for the chart.
 */

type Rules = BattlePostbattleRules | undefined;

/** The exploration table as the info tooltip lists it: "6-11" → 2. */
export function explorationTableRows(rules: Rules) {
  const rows: { diceResult: string; shardsFound: string }[] = [];
  let previousMax = 0;
  for (const row of rules?.exploration_table ?? []) {
    if (row.amount > 0) {
      const range =
        row.max_total === null ? `${previousMax + 1}+` : `${previousMax + 1}-${row.max_total}`;
      rows.push({ diceResult: range, shardsFound: String(row.amount) });
    }
    previousMax = row.max_total ?? previousMax;
  }
  return rows;
}

/** How many exploration dice can be rolled and chosen. */
export function explorationDiceLimits(rules: Rules) {
  return rules?.exploration_dice ?? DEFAULT_EXPLORATION_DICE;
}

/** The exploration amount for the chosen dice, by the server's table. */
export function explorationAmount(rules: Rules, diceValues: Array<number | null>) {
  const total = diceValues.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const row = rules?.exploration_table.find(
    (entry) => entry.max_total === null || total <= entry.max_total
  );
  return row?.amount ?? 0;
}

/** The draft saved so far, with the server's suggested XP and upkeep for the rest. */
export function suggestedDraft(
  participant: BattleParticipant,
  roster: ParticipantRoster | undefined,
  resources: WarbandResource[],
  suggestion: BattlePostbattleSuggestion | undefined
) {
  return buildPostbattleDraft(participant, roster, resources, suggestion);
}

/** The exploration roll saved with the draft, or the server's suggested dice. */
export function suggestedExploration(
  participant: BattleParticipant,
  resources: WarbandResource[],
  suggestion: BattlePostbattleSuggestion | undefined,
  rules: Rules
) {
  return buildLocalExplorationState(
    participant,
    resources,
    suggestion?.exploration,
    explorationDiceLimits(rules)
  );
}

/** The campaign's serious-injury table for heroes. */
export function heroDeathRollFor(rules: Rules): CampaignHeroDeathRoll {
  return rules?.hero_death_roll ?? "d66";
}

export type InjuryRollUnitKind = "hero" | "hireling" | "henchman";

/** The dice a serious-injury roll takes: 2D6 (D66) or D100 for heroes, a D6 for the rest. */
export function seriousInjuryNotation(
  unitKind: InjuryRollUnitKind | null,
  heroRoll: CampaignHeroDeathRoll
) {
  if (unitKind === "hero") {
    return heroRoll === "d100" ? "1d100" : "2d6";
  }
  return "1d6";
}

const clamp = (value: number, max: number) => Math.max(1, Math.min(max, Math.trunc(value || 1)));

/** The serious-injury entry for the rolled dice, from the server's table for the unit's kind. */
export function seriousInjuryRoll(
  unitKind: InjuryRollUnitKind,
  values: number[],
  rules: Rules
): BattlePostbattleSeriousInjuryRoll {
  const rollType = unitKind === "hero" ? heroDeathRollFor(rules) : "d6";
  let rolls: number[];
  let code: number;
  let resultCode: string;
  if (rollType === "d66") {
    rolls = [clamp(values[0], 6), clamp(values[1], 6)];
    code = rolls[0] * 10 + rolls[1];
    resultCode = String(code);
  } else if (rollType === "d100") {
    rolls = [clamp(values[0], 100)];
    code = rolls[0];
    resultCode = String(code).padStart(2, "0");
  } else {
    rolls = [clamp(values[0], 6)];
    code = rolls[0];
    resultCode = String(code);
  }
  const row: BattleInjuryTableRow | undefined = rules?.injury_tables[rollType].find(
    (entry) => code >= entry.low && code <= entry.high
  );
  return {
    roll_type: rollType,
    rolls,
    result_code: resultCode,
    result_label: row?.label ?? "Check the serious injury chart manually",
    dead_suggestion: row?.effect.kind === "dead",
    ...(row ? { effect: row.effect } : {}),
  };
}
