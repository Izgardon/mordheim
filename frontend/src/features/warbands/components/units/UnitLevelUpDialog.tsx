import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@components/dialog";
import { Button } from "@components/button";
import { Tooltip } from "@components/tooltip";
import { Info } from "lucide-react";

import { useUnitLevelUp } from "../../hooks/units/useUnitLevelUp";
import UnitStatsTable from "../shared/unit_details/UnitStatsTable";
import {
  AdvanceCheckbox,
  AdvanceOptionsRow,
  LadsGotTalentPanel,
  RollPanel,
  RollResultPanel,
} from "./level-up/LevelUpPanels";

import type { UnitLevelUpOptions } from "../../hooks/units/level-up-types";
import type { UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";

type UnitLevelUpDialogProps<K extends UnitKindKey> = UnitLevelUpOptions<K> & {
  kind: UnitKindConfig<K>;
};

export default function UnitLevelUpDialog<K extends UnitKindKey>({
  kind,
  ...options
}: UnitLevelUpDialogProps<K>) {
  const { open, onOpenChange } = options;
  const levelUp = useUnitLevelUp(kind, options);
  const { followUp, ladsGotTalent } = levelUp;
  const { rollTable } = kind.levelUp;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Level Up</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-6">
            <RollPanel
              diceColor={levelUp.diceColor}
              notation="2d6"
              title="2d6 Roll"
              description="Roll to determine the advance result."
              rollSignal={levelUp.rollSignal2d6}
              onRoll={levelUp.triggerRoll2d6}
              onRollComplete={levelUp.handleRoll2d6Complete}
            />
            {followUp ? (
              <RollPanel
                diceColor={levelUp.diceColor}
                notation="1d6"
                title="1d6 Roll"
                description="D6 roll for advances"
                disabled={!followUp.canRollSecondDie}
                rollSignal={followUp.rollSignal1d6}
                onRoll={followUp.triggerRoll1d6}
                onRollComplete={followUp.handleRoll1d6Complete}
              />
            ) : null}
            {ladsGotTalent ? <RollResultPanel advance={ladsGotTalent} /> : null}
          </section>
          <section className="space-y-4 border-t border-border/50 pt-4">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-lg font-semibold text-foreground">Advance</h3>
                <Tooltip
                  trigger={
                    <button
                      type="button"
                      aria-label="Advance roll table"
                      className="flex rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e7549]"
                    >
                      <Info className="h-4 w-4 cursor-help" aria-hidden="true" />
                    </button>
                  }
                  maxWidth={rollTable.maxWidth}
                  content={
                    <div className="space-y-0.5 text-xs">
                      {rollTable.lines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                      {rollTable.footnote ? (
                        <p className="mt-1 text-[0.65rem] opacity-75">{rollTable.footnote}</p>
                      ) : null}
                    </div>
                  }
                />
              </div>
              <p className="text-sm text-muted-foreground">Manually select if rolling in person.</p>
            </div>
            <div className="flex justify-center">
              <UnitStatsTable
                stats={levelUp.unitStats}
                raceStats={levelUp.raceStats}
                variant="race"
                valueDelta={levelUp.statDelta}
                wrapperClassName="w-full"
                renderExtraRow={(statLabel) => (
                  <AdvanceCheckbox
                    statLabel={statLabel}
                    isSelectable={levelUp.selectableStatSet.has(statLabel)}
                    isAtMax={levelUp.statsAtMax.has(statLabel)}
                    checked={levelUp.selectedStat === statLabel}
                    onToggle={() => levelUp.handleSelectStat(statLabel)}
                  />
                )}
              />
            </div>
            {followUp ? (
              <AdvanceOptionsRow
                advance={followUp}
                selectedStat={levelUp.selectedStat}
                onSelect={levelUp.handleSelectStat}
              />
            ) : null}
            {ladsGotTalent ? <LadsGotTalentPanel advance={ladsGotTalent} /> : null}
            {levelUp.raceMaxWarning ? (
              <p role="status" className="text-sm text-amber-400">
                {levelUp.raceMaxWarning}
              </p>
            ) : null}
            {levelUp.levelUpError ? (
              <p className="text-sm text-red-600">{levelUp.levelUpError}</p>
            ) : null}
          </section>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={levelUp.handleLevelUpConfirm} disabled={levelUp.isConfirmDisabled}>
            {levelUp.isSubmitting ? "Logging..." : "Level up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
