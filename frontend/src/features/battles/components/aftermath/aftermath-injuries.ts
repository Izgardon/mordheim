import {
  heroDeathRollFor,
  seriousInjuryRoll,
  type InjuryTable,
} from "@/features/battles/components/postbattle/postbattle-rules";
import {
  buildRenderableGroups,
  updateUnitResult,
  type PostbattleRenderableRow,
} from "@/features/battles/components/postbattle/postbattle-utils";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type {
  BattlePostbattleRules,
  BattlePostbattleSeriousInjuryRoll,
  BattlePostbattleState,
} from "@/features/battles/types/battle-types";
import { rollDie } from "@/lib/dice";

/** The units the Injuries tab rolls for: everyone taken out of action. */
export function injuryRows(draft: BattlePostbattleState, roster: ParticipantRoster | undefined) {
  return buildRenderableGroups(draft, roster)
    .flatMap((group) => group.rows)
    .filter((row) => row.outOfAction);
}

/** "D66", "D100" or "D6 · dies on 1–2": the dice a row rolls, as its subtitle says. */
export function injuryDice(table: InjuryTable, rules: BattlePostbattleRules | undefined) {
  if (table === "henchman") return "D6";
  return heroDeathRollFor(rules) === "d100" ? "D100" : "D66";
}

/**
 * The draft with a serious-injury roll added for `row` (only the last roll counts): dead when the
 * table says so, and the missing games it offers ticked at once (a D3 is rolled here); the player
 * can untick them.
 */
export function withInjuryRoll(
  draft: BattlePostbattleState,
  row: PostbattleRenderableRow,
  rules: BattlePostbattleRules | undefined
) {
  const hero = row.injuryTable === "hero";
  const values =
    hero && heroDeathRollFor(rules) === "d100"
      ? [rollDie(100)]
      : hero
        ? [rollDie(6), rollDie(6)]
        : [rollDie(6)];
  const roll = seriousInjuryRoll(row.injuryTable, values, rules);
  const misses = roll.effect?.misses;
  const games = misses?.dice ? rollDie(Number(misses.dice.replace(/\D/g, "")) || 3) : misses?.games;
  return updateUnitResult(draft, row.unitKey, (current) => {
    const { missing_games: _dropped, ...rest } = current;
    return {
      ...rest,
      dead: roll.dead_suggestion,
      serious_injury_rolls: [...current.serious_injury_rolls, roll],
      ...(games && row.unitKind !== "henchman" && !roll.dead_suggestion
        ? { missing_games: { games, reason: roll.result_label } }
        : {}),
    };
  });
}

/** The draft without the row's last roll: the one before it (if any) stands, missing games go. */
export function withoutLastRoll(draft: BattlePostbattleState, unitKey: string) {
  return updateUnitResult(draft, unitKey, (current) => {
    const rolls = current.serious_injury_rolls.slice(0, -1);
    const { missing_games: _dropped, ...rest } = current;
    return {
      ...rest,
      serious_injury_rolls: rolls,
      dead: Boolean(rolls[rolls.length - 1]?.dead_suggestion),
    };
  });
}

/** The draft with the row's missing games ticked (set at Ready) or not. */
export function withMissingTicked(
  draft: BattlePostbattleState,
  row: PostbattleRenderableRow,
  ticked: boolean,
  games: number
) {
  const roll = row.seriousInjuryRolls[row.seriousInjuryRolls.length - 1];
  return updateUnitResult(draft, row.unitKey, (current) => {
    const { missing_games: _dropped, ...rest } = current;
    return ticked ? { ...rest, missing_games: { games, reason: roll?.result_label ?? "" } } : rest;
  });
}

/** The book's line for a roll's result, from the server's table ("" for the D6's and the D100's). */
export function injuryText(
  rules: BattlePostbattleRules | undefined,
  roll: Pick<BattlePostbattleSeriousInjuryRoll, "roll_type" | "result_code"> | undefined
) {
  if (!roll) return "";
  const code = Number(roll.result_code);
  const row = rules?.injury_tables[roll.roll_type]?.find(
    (entry) => code >= entry.low && code <= entry.high
  );
  return row?.text ?? "";
}
