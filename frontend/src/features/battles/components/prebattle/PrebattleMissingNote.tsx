import type { BattleRosterMissingFields } from "@/features/battles/types/battle-types";

/** "Missing (2 more games)", with why: how a missing unit's prebattle row reads. */
export function missingLabel({ missingGames = 0, missingReason }: BattleRosterMissingFields) {
  if (missingGames <= 0) {
    return null;
  }
  const games = `${missingGames} more game${missingGames === 1 ? "" : "s"}`;
  const reason = missingReason?.trim();
  return `Missing (${games})${reason ? `: ${reason}` : ""}`;
}

/**
 * A missing unit's note in prebattle: it starts unpicked, and picking it anyway warns (a guide,
 * not a gatekeeper) that this battle still counts one of its games.
 */
export default function PrebattleMissingNote({
  unit,
  selected,
}: {
  unit: BattleRosterMissingFields;
  selected: boolean;
}) {
  const label = missingLabel(unit);
  if (!label) {
    return null;
  }
  return (
    <>
      <p className="text-xs text-amber-300">{label}</p>
      {selected ? (
        <p role="status" className="text-xs text-amber-300">
          Brought anyway: it should miss this battle, which still counts one game off.
        </p>
      ) : null}
    </>
  );
}
