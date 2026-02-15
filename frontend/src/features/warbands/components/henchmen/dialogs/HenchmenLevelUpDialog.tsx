import { useEffect, useState } from "react";

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
import { useAppStore } from "@/stores/app-store";
import { getWarbandHenchmenGroupDetail, levelUpWarbandHenchmenGroup } from "../../../api/warbands-api";
import UnitStatsTable from "../../shared/unit_details/UnitStatsTable";

import type { UnitStats } from "../../shared/unit_details/UnitStatsTable";
import type { HenchmenGroup } from "../../../types/warband-types";

const selectableStatLabels = ["WS", "BS", "S", "I", "A", "Ld"] as const;

type SelectableStatLabel = (typeof selectableStatLabels)[number];

const selectableStatSet = new Set<string>(selectableStatLabels);

const groupToUnitStats = (group: HenchmenGroup): UnitStats => ({
  movement: group.movement,
  weapon_skill: group.weapon_skill,
  ballistic_skill: group.ballistic_skill,
  strength: group.strength,
  toughness: group.toughness,
  wounds: group.wounds,
  initiative: group.initiative,
  attacks: group.attacks,
  leadership: group.leadership,
  armour_save: group.armour_save,
});

const groupRaceToUnitStats = (group: HenchmenGroup): UnitStats | null => {
  if (!group.race) return null;
  return {
    movement: group.race.movement,
    weapon_skill: group.race.weapon_skill,
    ballistic_skill: group.race.ballistic_skill,
    strength: group.race.strength,
    toughness: group.race.toughness,
    wounds: group.race.wounds,
    initiative: group.race.initiative,
    attacks: group.race.attacks,
    leadership: group.race.leadership,
  };
};

type HenchmenLevelUpDialogProps = {
  group: HenchmenGroup;
  warbandId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLevelUpLogged?: (updatedGroup: HenchmenGroup) => void;
};

export default function HenchmenLevelUpDialog({
  group,
  warbandId,
  open,
  onOpenChange,
  onLevelUpLogged,
}: HenchmenLevelUpDialogProps) {
  const [rollSignal2d6, setRollSignal2d6] = useState(0);
  const [hasRolled2d6, setHasRolled2d6] = useState(false);
  const [roll2d6Total, setRoll2d6Total] = useState<number | null>(null);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [ladsGotTalent, setLadsGotTalent] = useState(false);
  const [selectedHenchmanId, setSelectedHenchmanId] = useState("");
  const [levelUpError, setLevelUpError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groupDetail, setGroupDetail] = useState<HenchmenGroup | null>(null);
  const [groupDetailLoading, setGroupDetailLoading] = useState(false);
  const { diceColor } = useAppStore();

  const isSelectableStat = (value: string | null): value is SelectableStatLabel =>
    Boolean(value && selectableStatSet.has(value));

  const parseRollTotal = (results: unknown): number | null => {
    if (results === null || results === undefined) {
      return null;
    }
    const values: number[] = [];
    const extractValues = (entry: unknown) => {
      if (!entry) {
        return;
      }
      if (typeof entry === "number" && Number.isFinite(entry)) {
        values.push(entry);
        return;
      }
      if (entry && typeof entry === "object" && "rolls" in entry) {
        const rolls = (entry as { rolls?: unknown }).rolls;
        if (Array.isArray(rolls)) {
          rolls.forEach((roll) => {
            if (typeof roll === "number" && Number.isFinite(roll)) {
              values.push(roll);
            } else if (roll && typeof roll === "object" && "value" in roll) {
              const value = Number((roll as { value?: unknown }).value);
              if (Number.isFinite(value)) {
                values.push(value);
              }
            }
          });
          return;
        }
      }
      if (entry && typeof entry === "object" && "value" in entry) {
        const value = Number((entry as { value?: unknown }).value);
        if (Number.isFinite(value)) {
          values.push(value);
        }
      }
    };

    if (Array.isArray(results)) {
      results.forEach(extractValues);
    } else {
      extractValues(results);
    }

    if (!values.length) {
      return null;
    }
    return values.reduce((sum, value) => sum + value, 0);
  };

  const isLadsGotTalentRoll = roll2d6Total !== null && roll2d6Total >= 10;

  const groupWithRace = groupDetail ?? group;
  const groupStats = groupToUnitStats(groupWithRace);
  const raceStats = groupRaceToUnitStats(groupWithRace);
  const statDelta = isSelectableStat(selectedStat)
    ? ({ [selectedStat]: 1 } as Partial<Record<string, number>>)
    : undefined;

  const statNameMap: Record<string, string> = {
    WS: "Weapon Skill",
    BS: "Ballistic Skill",
    S: "Strength",
    I: "Initiative",
    A: "Attack",
    Ld: "Leadership",
  };

  const resolveAdvanceLabel = (value: string) => statNameMap[value] ?? value;

  const henchmenOptions = (groupWithRace.henchmen ?? []).map((henchman, index) => ({
    id: String(henchman.id ?? index),
    label: henchman.name?.trim() || `Henchman ${index + 1}`,
  }));

  useEffect(() => {
    if (!open) {
      return;
    }
    if (ladsGotTalent && !selectedHenchmanId && henchmenOptions.length > 0) {
      setSelectedHenchmanId(henchmenOptions[0].id);
    }
  }, [henchmenOptions, ladsGotTalent, open, selectedHenchmanId]);

  useEffect(() => {
    setGroupDetail(null);
  }, [group.id]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (group.race || groupDetail?.race || groupDetailLoading) {
      return;
    }
    setGroupDetailLoading(true);
    getWarbandHenchmenGroupDetail(warbandId, group.id)
      .then((data) => {
        setGroupDetail(data);
      })
      .catch(() => {
        setGroupDetail(null);
      })
      .finally(() => {
        setGroupDetailLoading(false);
      });
  }, [group.id, group.race, groupDetail?.race, groupDetailLoading, open, warbandId]);

  useEffect(() => {
    setRollSignal2d6(0);
    setSelectedStat(null);
    setHasRolled2d6(false);
    setRoll2d6Total(null);
    setLadsGotTalent(false);
    setSelectedHenchmanId("");
    setLevelUpError("");
    setIsSubmitting(false);
  }, [open]);

  const handleSelectStat = (statId: string) => {
    setSelectedStat((current) => (current === statId ? null : statId));
    setLevelUpError("");
  };

  const handleLevelUpConfirm = async () => {
    if (!selectedStat) {
      setLevelUpError("A Level up must be chosen.");
      return;
    }
    if (ladsGotTalent && isLadsGotTalentRoll) {
      setLevelUpError("Lads Got Talent rolled - roll again for a stat increase.");
      return;
    }

    const groupName = group.name?.trim() || group.unit_type?.trim() || "Henchmen Group";
    const advanceLabel = resolveAdvanceLabel(selectedStat);
    const roll1 = roll2d6Total !== null
      ? { dice: "2d6", result: { total: roll2d6Total } }
      : undefined;

    setIsSubmitting(true);
    setLevelUpError("");
    try {
      const updatedGroup = await levelUpWarbandHenchmenGroup(warbandId, group.id, {
        group: groupName,
        advance: {
          id: selectedStat,
          label: advanceLabel,
        },
        ...(roll1 ? { roll1 } : {}),
        ...(ladsGotTalent
          ? {
              lads_got_talent: true,
              henchman_id: selectedHenchmanId || null,
              henchman_name:
                henchmenOptions.find((option) => option.id === selectedHenchmanId)?.label ?? null,
            }
          : {}),
      });
      if (updatedGroup) {
        onLevelUpLogged?.(updatedGroup);
      }
      onOpenChange(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setLevelUpError(errorResponse.message || "Unable to log level up");
      } else {
        setLevelUpError("Unable to log level up");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const shouldPromptReroll = ladsGotTalent && isLadsGotTalentRoll;

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
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setRollSignal2d6((prev) => prev + 1);
                    setHasRolled2d6(true);
                    setRoll2d6Total(null);
                    setLevelUpError("");
                  }}
                >
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
                  onRollComplete={(results) => {
                    const total = parseRollTotal(results);
                    setRoll2d6Total(total);
                    if (total === null) {
                      return;
                    }
                    if (total >= 10) {
                      setSelectedStat(null);
                      setLadsGotTalent(true);
                      return;
                    }
                    if (total <= 4) {
                      setSelectedStat("I");
                      return;
                    }
                    if (total === 5) {
                      setSelectedStat("S");
                      return;
                    }
                    if (total === 6 || total === 7) {
                      setSelectedStat("WS");
                      return;
                    }
                    if (total === 8) {
                      setSelectedStat("A");
                      return;
                    }
                    if (total === 9) {
                      setSelectedStat("Ld");
                    }
                  }}
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
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setLadsGotTalent(checked);
                    if (checked && henchmenOptions.length > 0 && !selectedHenchmanId) {
                      setSelectedHenchmanId(henchmenOptions[0].id);
                    }
                  }}
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
