import DiceRoller from "@/components/dice/DiceRoller";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  seriousInjuryNotation,
  type InjuryTable,
} from "@/features/battles/components/postbattle/postbattle-rules";
import { HELPER_DIALOG_CONTENT_CLASS } from "@/features/battles/components/shared/battle-dialog-styles";
import type { CampaignHeroDeathRoll } from "@/features/campaigns/types/campaign-types";

export type InjuryRollTarget = {
  unitKey: string;
  unitName: string;
  /** The table it rolls on: the campaign's hero table, or a D6. */
  injuryTable: InjuryTable;
} | null;

/**
 * The serious-injury roll for a unit taken out of action: the campaign's table for heroes and
 * hero-table hirelings, a D6 for the rest.
 */
export default function SeriousInjuryRollDialog({
  target,
  heroRollType,
  themeColor,
  open,
  disabled,
  onOpenChange,
  onRollComplete,
  onRollingChange,
}: {
  target: InjuryRollTarget;
  heroRollType: CampaignHeroDeathRoll;
  themeColor: string;
  open: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onRollComplete: (results: unknown) => void;
  onRollingChange: (isRolling: boolean) => void;
}) {
  if (!target) return null;
  const isHero = target.injuryTable === "hero";
  const heroRollLabel = heroRollType.toUpperCase();
  const notation = seriousInjuryNotation(target.injuryTable, heroRollType);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-lg ${HELPER_DIALOG_CONTENT_CLASS}`}>
        <DialogHeader>
          <DialogTitle>Serious Injury Roll</DialogTitle>
          <DialogDescription>
            {isHero
              ? `Roll a ${heroRollLabel} guide for ${target.unitName}.`
              : `Roll a D6 for ${target.unitName}. A 1-2 suggests death; 3-6 suggests survival.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <DiceRoller
            mode="fixed"
            fixedNotation={notation}
            themeColor={themeColor}
            resultMode={notation === "2d6" ? "both" : "total"}
            showResultBox
            showRollLabel={false}
            rollDisabled={disabled}
            onRollComplete={onRollComplete}
            onRollingChange={onRollingChange}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
