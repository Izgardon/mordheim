import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@components/dialog";
import { Button } from "@components/button";
import { Checkbox } from "@components/checkbox";
import DiceRoller from "@/components/dice/DiceRoller";
import useHiredSwordLevelUp from "../../../hooks/levelup/useHiredSwordLevelUp";
import UnitStatsTable from "../../shared/unit_details/UnitStatsTable";

import type { WarbandHiredSword } from "../../../types/warband-types";

type HiredSwordLevelUpDialogProps = {
  hiredSword: WarbandHiredSword;
  warbandId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLevelUpLogged?: (updated: WarbandHiredSword) => void;
};

export default function HiredSwordLevelUpDialog({
  hiredSword,
  warbandId,
  open,
  onOpenChange,
  onLevelUpLogged,
}: HiredSwordLevelUpDialogProps) {
  const {
    rollSignal2d6,
    rollSignal1d6,
    canRollSecondDie,
    diceColor,
    selectedStat,
    statDelta,
    unitStats,
    raceStats,
    availableOtherOptions,
    selectableStatSet,
    levelUpError,
    isSubmitting,
    handleSelectStat,
    triggerRoll2d6,
    triggerRoll1d6,
    handleRoll2d6Complete,
    handleRoll1d6Complete,
    handleLevelUpConfirm,
  } = useHiredSwordLevelUp({ hiredSword, warbandId, open, onOpenChange, onLevelUpLogged });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[560px]"
        helpContent={
          <div className="space-y-2 text-xs text-[#2a1f1a]">
            <p className="font-semibold uppercase tracking-[0.2em] text-[#2a1f1a]">
              Level up helper
            </p>
            <div className="space-y-1">
              <p>2d6 roll 6: roll 1d6 (1-3 Strength, 4-6 Attacks).</p>
              <p>2d6 roll 7: choose WS/BS (auto-select WS).</p>
              <p>2d6 roll 8: roll 1d6 (1-3 Initiative, 4-6 Leadership).</p>
              <p>2d6 roll 9: roll 1d6 (1-3 Wound, 4-6 Toughness).</p>
              <p>Any other roll: auto-select Skill.</p>
            </div>
          </div>
        }
      >
        <DialogHeader>
          <DialogTitle>Level Up</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-6">
            <div className="flex h-full flex-col gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">2d6 Roll</h3>
                <p className="text-sm text-muted-foreground">
                  Roll to determine the advance result.
                </p>
              </div>
              <div className="mt-auto flex items-center gap-4">
                <Button type="button" onClick={triggerRoll2d6}>
                  2d6
                </Button>
                <DiceRoller
                  mode="fixed"
                  fixedNotation="2d6"
                  fullScreen
                  themeColor={diceColor}
                  showRollButton={false}
                  resultMode="total"
                  showResultBox
                  rollSignal={rollSignal2d6}
                  onRollComplete={handleRoll2d6Complete}
                />
              </div>
            </div>
            <div className="flex h-full flex-col gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">1d6 Roll</h3>
                <p className="text-sm text-muted-foreground">D6 roll for advances</p>
              </div>
              <div className="mt-auto flex items-center gap-4">
                <Button type="button" disabled={!canRollSecondDie} onClick={triggerRoll1d6}>
                  1d6
                </Button>
                <DiceRoller
                  mode="fixed"
                  fixedNotation="1d6"
                  fullScreen
                  themeColor={diceColor}
                  showRollButton={false}
                  resultMode="total"
                  showResultBox
                  rollSignal={rollSignal1d6}
                  onRollComplete={handleRoll1d6Complete}
                />
              </div>
            </div>
          </section>
          <section className="space-y-4 border-t border-border/50 pt-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Advance</h3>
              <p className="text-sm text-muted-foreground">Manually select if rolling in person.</p>
            </div>
            <div className="flex justify-center">
              <UnitStatsTable
                stats={unitStats}
                raceStats={raceStats}
                variant="race"
                valueDelta={statDelta}
                wrapperClassName="w-full"
                renderExtraRow={(statLabel) => (
                  <div className="flex justify-center">
                    {selectableStatSet.has(statLabel) ? (
                      <Checkbox
                        checked={selectedStat === statLabel}
                        onChange={() => handleSelectStat(statLabel)}
                      />
                    ) : null}
                  </div>
                )}
              />
            </div>
            <div className="flex items-center justify-center gap-6">
              {availableOtherOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    checked={selectedStat === option.id}
                    onChange={() => handleSelectStat(option.id)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {levelUpError ? <p className="text-sm text-red-600">{levelUpError}</p> : null}
          </section>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleLevelUpConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Logging..." : "Level up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
