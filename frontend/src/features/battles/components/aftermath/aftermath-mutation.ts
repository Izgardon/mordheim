import {
  updateUnitResult,
  type PostbattleRenderableRow,
} from "@/features/battles/components/postbattle/postbattle-utils";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type {
  BattlePostbattleMutationRoll,
  BattlePostbattleRules,
  BattlePostbattleState,
  BattleRandomMutation,
} from "@/features/battles/types/battle-types";

/*
 * The D100 serious injury result 100, Mutation (William, 5 Nov 2026): a follow-up D66 on the
 * random mutation table, kept on the unit's last roll. The server's table (the rules'
 * `random_mutations`) names the result and the special it gives, which the unit gains at Ready.
 */

/** The units whose last roll is a Mutation: each gets the follow-up card. */
export const mutationRows = (rows: PostbattleRenderableRow[]) =>
  rows.filter(
    (row) =>
      !row.dead &&
      row.seriousInjuryRolls[row.seriousInjuryRolls.length - 1]?.effect?.kind === "mutation"
  );

/** The table's row for a follow-up roll (none before it is rolled). */
export function mutationResult(
  rules: BattlePostbattleRules | undefined,
  mutation: Pick<BattlePostbattleMutationRoll, "rolls"> | undefined
): BattleRandomMutation | undefined {
  if (!mutation) return undefined;
  const code = mutation.rolls[0] * 10 + mutation.rolls[1];
  return rules?.random_mutations?.find((row) => row.roll === code);
}

const lastRollWith = (
  draft: BattlePostbattleState,
  unitKey: string,
  mutation: BattlePostbattleMutationRoll | undefined
) =>
  updateUnitResult(draft, unitKey, (current) => {
    const rolls = current.serious_injury_rolls;
    const last = rolls[rolls.length - 1];
    if (!last) return current;
    const { mutation: _dropped, ...roll } = last;
    return {
      ...current,
      serious_injury_rolls: [...rolls.slice(0, -1), mutation ? { ...roll, mutation } : roll],
    };
  });

/**
 * The draft with the follow-up's faces, rolled or typed (tens then units), and what the table
 * says of them.
 */
export function withMutationRoll(
  draft: BattlePostbattleState,
  unitKey: string,
  faces: number[],
  rules: BattlePostbattleRules | undefined
) {
  const rolls = [faces[0], faces[1]].map((face) => Math.max(1, Math.min(6, Math.trunc(face || 1))));
  const row = mutationResult(rules, { rolls });
  return lastRollWith(draft, unitKey, {
    rolls,
    result_code: String(rolls[0] * 10 + rolls[1]),
    ...(row ? { name: row.name, special: row.special, special_type: row.special_type } : {}),
  });
}

/** The draft without the follow-up: back to Roll D66. */
export const withoutMutationRoll = (draft: BattlePostbattleState, unitKey: string) =>
  lastRollWith(draft, unitKey, undefined);

const fold = (text: string) => text.trim().toLowerCase();

/** Whether the unit already has the special a result gives (the table says roll again). */
export function hasMutation(
  roster: ParticipantRoster | undefined,
  unitKey: string,
  special: string
) {
  const units = [...(roster?.heroes ?? []), ...(roster?.hirelings ?? [])];
  const unit = units.find((entry) => entry.key === unitKey);
  return Boolean(unit?.specials?.some((owned) => fold(owned.name) === fold(special)));
}
