import { Checkbox } from "@/components/ui/checkbox";
import type { BattleUnitStats } from "@/features/battles/types/battle-types";

const STAT_LABELS: Record<keyof BattleUnitStats, string> = {
  movement: "M",
  weapon_skill: "WS",
  ballistic_skill: "BS",
  strength: "S",
  toughness: "T",
  wounds: "W",
  initiative: "I",
  attacks: "A",
  leadership: "Ld",
  armour_save: "AS",
};

const shown = (value: unknown) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

/** "WS 4 → 5" for each stat the battle changed. */
export function statChanges(
  base: Record<string, unknown> | undefined,
  override: Record<string, unknown> | undefined
) {
  return Object.entries(override ?? {})
    .filter(([stat, value]) => value !== undefined && base?.[stat] !== value)
    .map(
      ([stat, value]) =>
        `${STAT_LABELS[stat as keyof BattleUnitStats] ?? stat} ${shown(base?.[stat])} → ${shown(value)}`
    );
}

type PostbattleKeepStatsTickProps = {
  unitName: string;
  changes: string[];
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
};

/**
 * Battle stat changes are temporary unless kept (SEC-10, decision 6): lists them and ticks "Keep"
 * (off by default). For a henchmen group one tick keeps the whole group's.
 */
export default function PostbattleKeepStatsTick({
  unitName,
  changes,
  checked,
  disabled,
  onChange,
}: PostbattleKeepStatsTickProps) {
  if (changes.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 text-xs">
      <p className="text-muted-foreground">Stat changes this battle: {changes.join(", ")}</p>
      <label className="flex h-9 items-center gap-2 text-sm text-foreground">
        <Checkbox
          checked={checked}
          disabled={disabled}
          aria-label={`Keep ${unitName}'s stat changes`}
          onChange={(event) => onChange(event.target.checked)}
        />
        Keep
      </label>
    </div>
  );
}
