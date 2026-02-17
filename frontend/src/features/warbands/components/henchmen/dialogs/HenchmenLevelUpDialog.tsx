import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@components/dialog";
import { Button } from "@components/button";
import { Checkbox } from "@components/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";
import DiceRoller from "@/components/dice/DiceRoller";
import useHenchmenLevelUp from "../../../hooks/levelup/useHenchmenLevelUp";
import UnitStatsTable from "../../shared/unit_details/UnitStatsTable";

import type { HenchmenGroup } from "../../../types/warband-types";

type HenchmenLevelUpDialogProps = {
  group: HenchmenGroup;
  warbandId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLevelUpLogged?: (updatedGroup: HenchmenGroup) => void;
  onGroupRemoved?: (groupId: number) => void;
};

export default function HenchmenLevelUpDialog({
  group,
  warbandId,
  open,
  onOpenChange,
  onLevelUpLogged,
  onGroupRemoved,
}: HenchmenLevelUpDialogProps) {
  const {
    rollSignal2d6,
    roll2d6Total,
    hasRolled2d6,
    diceColor,
    selectedStat,
    statDelta,
    groupStats,
    raceStats,
    selectableStatSet,
    ladsGotTalent,
    shouldPromptReroll,
    selectedHenchmanId,
    setSelectedHenchmanId,
    henchmenOptions,
    setLadsGotTalentChecked,
    levelUpError,
    isSubmitting,
    handleSelectStat,
    triggerRoll2d6,
    handleRoll2d6Complete,
    handleLevelUpConfirm,
  } = useHenchmenLevelUp({
    group,
    warbandId,
    open,
    onOpenChange,
    onLevelUpLogged,
    onGroupRemoved,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
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
                <Button type="button" size="sm" onClick={triggerRoll2d6}>
                  Roll 2d6
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
                <h3 className="text-lg font-semibold text-foreground">Result</h3>
                <p className="text-sm text-muted-foreground">
                  {hasRolled2d6
                    ? `Result: ${roll2d6Total ?? ''}`
                    : "Roll the dice to determine the advance."}
                </p>
              </div>
              <div className="mt-auto text-xs text-muted-foreground">
                2-4: +1 Initiative • 5: +1 Strength • 6-7: +1 WS/BS • 8: +1 Attack • 9: +1 Leadership • 10-12: Lads Got Talent
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
                stats={groupStats}
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
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={ladsGotTalent}
                  onChange={(event) => setLadsGotTalentChecked(event.target.checked)}
                />
                <span>Lads got talent</span>
              </label>
              <div className="min-w-[200px] flex-1">
                <Select
                  value={selectedHenchmanId}
                  onValueChange={setSelectedHenchmanId}
                  disabled={!ladsGotTalent || henchmenOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select henchman" />
                  </SelectTrigger>
                  <SelectContent>
                    {henchmenOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {shouldPromptReroll ? (
              <p className="text-sm text-amber-500">
                Lads Got Talent rolled - roll again until you get a stat increase.
              </p>
            ) : null}
            {levelUpError ? <p className="text-sm text-red-600">{levelUpError}</p> : null}
          </section>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleLevelUpConfirm}
            disabled={isSubmitting || !selectedStat || shouldPromptReroll}
          >
            {isSubmitting ? "Logging..." : "Level up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
