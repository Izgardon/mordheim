import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import {
  buildD6SeriousInjuryRoll,
  buildHeroSeriousInjuryRoll,
  buildLocalExplorationState,
  buildPostbattleDraft,
  getExplorationResourceAmount,
} from "@/features/battles/components/postbattle/postbattle-utils";
import type {
  BattleEvent,
  BattleParticipant,
  BattleSummary,
} from "@/features/battles/types/battle-types";
import type {
  CampaignHeroDeathRoll,
  CampaignSummary,
} from "@/features/campaigns/types/campaign-types";
import type { WarbandResource } from "@/features/warbands/types/warband-types";

/**
 * The postbattle rules and suggestions the page still works out itself, in one place (IMP-52).
 * When the server's `suggested_postbattle` (XP per unit, exploration dice, upkeep) and `rules`
 * block (exploration table, injury tables, hero death roll) reach the postbattle state, only this
 * module changes: the page reads the table, the limits and the suggestions from here.
 */

/** Shards found per exploration total. */
export const EXPLORATION_SHARD_TABLE = [
  { diceResult: "1-5", shardsFound: "1" },
  { diceResult: "6-11", shardsFound: "2" },
  { diceResult: "12-17", shardsFound: "3" },
  { diceResult: "18-24", shardsFound: "4" },
  { diceResult: "25-30", shardsFound: "5" },
  { diceResult: "31-35", shardsFound: "6" },
  { diceResult: "36+", shardsFound: "7" },
] as const;

/** At most this many exploration dice can be rolled, and this many chosen. */
export const MAX_EXPLORATION_DICE = 10;
export const MAX_CHOSEN_EXPLORATION_DICE = 6;

/** The exploration amount for the chosen dice, by the table. */
export function explorationAmount(diceValues: Array<number | null>) {
  return getExplorationResourceAmount(diceValues);
}

/** The draft with today's suggestions filled in (XP per unit, upkeep), or the saved one. */
export function suggestedDraft(
  participant: BattleParticipant,
  roster: ParticipantRoster | undefined,
  resources: WarbandResource[],
  events: BattleEvent[]
) {
  return buildPostbattleDraft(participant, roster, resources, events);
}

/** The exploration roll saved with the draft, or the suggested dice for a new one. */
export function suggestedExploration(
  participant: BattleParticipant,
  roster: ParticipantRoster | undefined,
  battle: BattleSummary,
  resources: WarbandResource[]
) {
  return buildLocalExplorationState(participant, roster, battle, resources);
}

/** The campaign's serious-injury table for heroes. */
export function heroDeathRollFor(
  campaign: Pick<CampaignSummary, "hero_death_roll"> | null | undefined
) {
  return campaign?.hero_death_roll ?? "d66";
}

export type InjuryRollUnitKind = "hero" | "hired_sword" | "henchman";

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

/** The serious-injury entry for the rolled dice, from the table for the unit's kind. */
export function seriousInjuryRoll(
  unitKind: InjuryRollUnitKind,
  values: number[],
  heroRoll: CampaignHeroDeathRoll
) {
  return unitKind === "hero"
    ? buildHeroSeriousInjuryRoll(values, heroRoll)
    : buildD6SeriousInjuryRoll(values[0]);
}
