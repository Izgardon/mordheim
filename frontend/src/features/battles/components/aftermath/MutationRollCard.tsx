import { Button } from "@/components/ui/button";
import DiceEntry from "@/components/ui/dice-entry";
import type { PostbattleRenderableRow } from "@/features/battles/components/postbattle/postbattle-utils";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type {
  BattlePostbattleRules,
  BattlePostbattleState,
} from "@/features/battles/types/battle-types";

import {
  hasMutation,
  mutationResult,
  withMutationRoll,
  withoutMutationRoll,
} from "./aftermath-mutation";
import RollCard from "./RollCard";

/** A result the unit has already: the table rolls again (a warning, never a block). */
export const HAS_IT = "He has it already. Roll again.";

/**
 * The D100 Mutation's follow-up on the Injuries step: a D66 on the random mutation table, rolled
 * or typed (tens then units), the result's name and the special's text (gained at Ready), with
 * Undo; one he has already warns, with Roll again beside it.
 */
export default function MutationRollCard({
  row,
  draft,
  roster,
  rules,
  isMobile,
  onChange,
}: {
  row: PostbattleRenderableRow;
  draft: BattlePostbattleState;
  roster: ParticipantRoster | undefined;
  rules: BattlePostbattleRules | undefined;
  isMobile: boolean;
  onChange: (next: BattlePostbattleState) => void;
}) {
  const mutation = row.seriousInjuryRolls[row.seriousInjuryRolls.length - 1]?.mutation;
  const result = mutationResult(rules, mutation);
  const already = result ? hasMutation(roster, row.unitKey, result.special) : false;
  const take = (faces: number[]) => onChange(withMutationRoll(draft, row.unitKey, faces, rules));

  return (
    <RollCard
      title={`${row.unitName}'s mutation`}
      subtitle="D66 · random mutation table"
      danger={already}
      isMobile={isMobile}
      rolled={
        mutation
          ? {
              faces: mutation.rolls,
              result: result?.name ?? "Check the random mutation table",
              good: !already,
              onUndo: () => onChange(withoutMutationRoll(draft, row.unitKey)),
            }
          : null
      }
      dice="D66"
      onFaces={take}
    >
      {result?.text ? (
        <p className="m-0 basis-full whitespace-pre-line text-[13px] leading-relaxed text-text2">
          {result.text}
        </p>
      ) : null}
      {already ? (
        <div className="flex basis-full flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[13px] font-semibold text-danger">{HAS_IT}</span>
          <DiceEntry
            dice="D66"
            size="sm"
            onFaces={take}
            button={(roll) => (
              <Button size="sm" variant="secondary" className="h-9" onClick={roll}>
                Roll again
              </Button>
            )}
          />
        </div>
      ) : null}
    </RollCard>
  );
}
