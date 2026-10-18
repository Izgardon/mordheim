import { BookOpen, PenLine } from "lucide-react";

import BattleOverflowMenu, {
  type BattleOverflowAction,
} from "@/features/battles/components/shared/BattleOverflowMenu";

/** The phone top bar's actions on a battle page: Battle Notes, the scenario link, More actions. */
export default function BattleTopBarActions({
  onOpenNotes,
  onOpenScenario,
  overflowActions,
}: {
  onOpenNotes?: () => void;
  onOpenScenario?: () => void;
  overflowActions?: BattleOverflowAction[];
}) {
  return (
    <>
      {onOpenNotes ? (
        <button
          type="button"
          onClick={onOpenNotes}
          className="icon-button flex h-9 w-9 items-center justify-center border-none bg-transparent p-0"
          aria-label="Battle Notes"
        >
          <PenLine className="theme-heading-soft h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}
      {onOpenScenario ? (
        <button
          type="button"
          onClick={onOpenScenario}
          className="icon-button mr-1 flex h-9 w-9 items-center justify-center border-none bg-transparent p-0"
          aria-label="View scenario link"
        >
          <BookOpen className="theme-heading-soft h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}
      {overflowActions ? <BattleOverflowMenu actions={overflowActions} /> : null}
    </>
  );
}
