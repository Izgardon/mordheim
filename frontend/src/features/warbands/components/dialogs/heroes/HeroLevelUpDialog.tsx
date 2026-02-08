import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@components/dialog";
import { Button } from "@components/button";
import { Checkbox } from "@components/checkbox";
import DiceRoller from "@/components/dice/DiceRoller";
import { useAppStore } from "@/stores/app-store";
import { getWarbandHeroDetail, levelUpWarbandHero } from "../../../api/warbands-api";
import UnitStatsTable from "@/components/units/UnitStatsTable";
import { heroRaceToUnitStats, heroToUnitStats } from "../../heroes/utils/hero-unit-stats";

import type { WarbandHero } from "../../../types/warband-types";

const selectableStatLabels = [
  "M",
  "WS",
  "BS",
  "S",
  "T",
  "W",
  "I",
  "A",
  "Ld",
] as const;

type SelectableStatLabel = (typeof selectableStatLabels)[number];

const selectableStatSet = new Set<string>(selectableStatLabels);

const otherOptions = [
  { id: "Skill", label: "Skill" },
  { id: "Spell", label: "Spell" },
  { id: "Feature", label: "Feature" },
];

type HeroLevelUpDialogProps = {
  hero: WarbandHero;
  warbandId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLevelUpLogged?: (updatedHero: WarbandHero) => void;
};

export default function HeroLevelUpDialog({
  hero,
  warbandId,
  open,
  onOpenChange,
  onLevelUpLogged,
}: HeroLevelUpDialogProps) {
  const [rollSignal2d6, setRollSignal2d6] = useState(0);
  const [rollSignal1d6, setRollSignal1d6] = useState(0);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [hasRolled2d6, setHasRolled2d6] = useState(false);
  const [roll2d6Total, setRoll2d6Total] = useState<number | null>(null);
  const [roll1d6Total, setRoll1d6Total] = useState<number | null>(null);
  const [levelUpError, setLevelUpError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [heroDetail, setHeroDetail] = useState<WarbandHero | null>(null);
  const [heroDetailLoading, setHeroDetailLoading] = useState(false);
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

  const canRollSecondDie =
    hasRolled2d6 && roll2d6Total !== null && [6, 8, 9].includes(roll2d6Total);

  const heroWithRace = heroDetail ?? hero;
  const heroStats = heroToUnitStats(heroWithRace);
  const raceStats = heroRaceToUnitStats(heroWithRace);
  const statDelta = isSelectableStat(selectedStat)
    ? ({ [selectedStat]: 1 } as Partial<Record<string, number>>)
    : undefined;

  const statNameMap: Record<string, string> = {
    M: "Movement",
    WS: "Weapon Skill",
    BS: "Ballistic Skill",
    S: "Strength",
    T: "Toughness",
    W: "Wound",
    I: "Initiative",
    A: "Attack",
    Ld: "Leadership",
    Skill: "Skill",
    Spell: "Spell",
    Feature: "Feature",
  };

  const resolveAdvanceLabel = (value: string) => statNameMap[value] ?? value;

  useEffect(() => {
    setHeroDetail(null);
  }, [hero.id]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (hero.race || heroDetail?.race || heroDetailLoading) {
      return;
    }
    setHeroDetailLoading(true);
    getWarbandHeroDetail(warbandId, hero.id)
      .then((data) => {
        setHeroDetail(data);
      })
      .catch(() => {
        setHeroDetail(null);
      })
      .finally(() => {
        setHeroDetailLoading(false);
      });
  }, [hero.id, hero.race, heroDetail?.race, heroDetailLoading, open, warbandId]);

  useEffect(() => {
    setRollSignal2d6(0);
    setRollSignal1d6(0);
    setSelectedStat(null);
    setHasRolled2d6(false);
    setRoll2d6Total(null);
    setRoll1d6Total(null);
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

    const heroName = hero.name?.trim() || hero.unit_type?.trim() || "Unknown Hero";
    const advanceLabel = resolveAdvanceLabel(selectedStat);
    const roll1 = roll2d6Total !== null
      ? { dice: "2d6", result: { total: roll2d6Total } }
      : undefined;
    const roll2 = roll1d6Total !== null
      ? { dice: "1d6", result: { total: roll1d6Total } }
      : undefined;

    setIsSubmitting(true);
    setLevelUpError("");
    try {
      const updatedHero = await levelUpWarbandHero(warbandId, hero.id, {
        hero: heroName,
        advance: {
          id: selectedStat,
          label: advanceLabel,
        },
        ...(roll1 ? { roll1 } : {}),
        ...(roll2 ? { roll2 } : {}),
      });
      if (updatedHero) {
        onLevelUpLogged?.(updatedHero);
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
                    setRoll1d6Total(null);
                    if (total === 6 || total === 8 || total === 9) {
                      setSelectedStat(null);
                    } else if (total === 7) {
                      setSelectedStat("WS");
                    } else if (total !== null) {
                      setSelectedStat("Skill");
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex h-full flex-col gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">1d6 Roll</h3>
                <p className="text-sm text-muted-foreground">D6 roll for advances</p>
              </div>
              <div className="mt-auto flex items-center gap-4">
                <Button
                  type="button"
                  size="sm"
                  disabled={!canRollSecondDie}
                  onClick={() => {
                    setRollSignal1d6((prev) => prev + 1);
                  }}
                >
                  Roll 1d6
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
                  onRollComplete={(results) => {
                    const total = parseRollTotal(results);
                    if (total === null) {
                      return;
                    }
                    setRoll1d6Total(total);
                    if (roll2d6Total === 6) {
                      setSelectedStat(total <= 3 ? "S" : "A");
                      return;
                    }
                    if (roll2d6Total === 8) {
                      setSelectedStat(total <= 3 ? "I" : "Ld");
                      return;
                    }
                    if (roll2d6Total === 9) {
                      setSelectedStat(total <= 3 ? "W" : "T");
                    }
                  }}
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
                stats={heroStats}
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
              {otherOptions.map((option) => (
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

