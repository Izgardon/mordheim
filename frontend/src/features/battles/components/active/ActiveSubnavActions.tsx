import { Button } from "@/components/ui/button";
import ActiveBattleHelpers from "@/features/battles/components/active/ActiveBattleHelpers";
import BattleOverflowMenu, {
  type BattleOverflowAction,
} from "@/features/battles/components/shared/BattleOverflowMenu";
import type { ActiveHelper } from "@/features/battles/hooks/useActivePage";

/** The active page's desktop subnav actions: Battle Notes, the helpers and More actions. */
export default function ActiveSubnavActions({
  onOpenNotes,
  helpers,
  overflowActions,
}: {
  onOpenNotes?: () => void;
  helpers: {
    rangedDisabled: boolean;
    meleeDisabled: boolean;
    showScenarioAction: boolean;
    onOpenHelper: (helper: ActiveHelper) => void;
    onOpenScenario: () => void;
  };
  overflowActions: BattleOverflowAction[];
}) {
  return (
    <>
      {onOpenNotes ? (
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onOpenNotes}>
            Battle Notes
          </Button>
          <div className="mx-1 h-7 w-px bg-border/70" aria-hidden="true" />
        </>
      ) : null}
      <ActiveBattleHelpers
        rangedDisabled={helpers.rangedDisabled}
        meleeDisabled={helpers.meleeDisabled}
        showScenarioAction={helpers.showScenarioAction}
        onOpenRanged={() => helpers.onOpenHelper("ranged")}
        onOpenMelee={() => helpers.onOpenHelper("melee")}
        onOpenCriticalHits={() => helpers.onOpenHelper("critical")}
        onOpenScenario={helpers.onOpenScenario}
      />
      {overflowActions.length > 0 ? (
        <>
          <div className="mx-1 h-7 w-px bg-border/70" aria-hidden="true" />
          <BattleOverflowMenu actions={overflowActions} appearance="button" />
        </>
      ) : null}
    </>
  );
}
