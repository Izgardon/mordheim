import { Button } from "@/components/ui/button";
import type { BattleState } from "@/features/battles/types/battle-types";
import { winnersText } from "@/features/battles/utils/battle-results";

/**
 * Where the results stand in postbattle (decision 4): waiting for the last player to finish to
 * confirm them (with Confirm results for him or a battle manager), or confirmed (Change results
 * until the battle ends).
 */
export default function PostbattleResultsBanner({
  battleState,
  canConfirm,
  onOpen,
}: {
  battleState: BattleState;
  canConfirm: boolean;
  onOpen: () => void;
}) {
  const { battle, participants } = battleState;
  if (battle.status !== "postbattle") {
    return null;
  }
  const confirmer = participants.find(
    (participant) => participant.user.id === battle.results_confirmer_user_id
  );
  const text = battle.results_pending
    ? canConfirm
      ? "Everyone has finished fighting. Confirm who won: the battle ends once the results are confirmed and every postbattle is done."
      : `Waiting for ${confirmer?.user.label ?? "the last player to finish"} to confirm the results.`
    : canConfirm
      ? `Results confirmed: ${winnersText(battleState)}. You can change them until the battle ends.`
      : null;
  if (!text) {
    return null;
  }
  return (
    <section
      aria-label="Results"
      className="battle-inline-panel flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2"
    >
      <p className={battle.results_pending ? "text-sm text-amber-300" : "text-sm text-foreground"}>
        {text}
      </p>
      {canConfirm ? (
        <Button type="button" size="sm" className="h-11" onClick={onOpen}>
          {battle.results_pending ? "Confirm results" : "Change results"}
        </Button>
      ) : null}
    </section>
  );
}
