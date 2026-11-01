import { Crosshair, Minus, Plus, RotateCw } from "lucide-react";

import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import { cn } from "@/lib/utils";

import { STATUS_LABEL, type UnitStatus } from "./battle-units";

/** The status colours (design E): standing is good, down or stunned accent, out of action danger. */
export const STATUS_TONE: Record<UnitStatus, string> = {
  standing: "border-good-line bg-good-bg text-good",
  knocked_down: "border-accent-line bg-accent-soft text-accent-hi",
  stunned: "border-accent-line bg-accent-soft text-accent-hi",
  out_of_action: "border-danger-line bg-danger-bg text-danger",
};

/** Which reference sheet a card's bottom row opens. */
export type GearTab = "gear" | "skills" | "spells";

/** The bottom row: Gear, and Skills or Spells (both when a caster has skills too). */
export function quickButtons(unit: PrebattleUnit, hideEmpty = false) {
  const skills = (unit.skills?.length ?? 0) + (unit.specials?.length ?? 0);
  const spells = unit.spells?.length ?? 0;
  return [
    { tab: "gear" as const, label: "Gear", count: unit.items?.length ?? 0 },
    ...(spells ? [{ tab: "spells" as const, label: "Spells", count: spells }] : []),
    ...(skills || (!spells && !hideEmpty)
      ? [{ tab: "skills" as const, label: "Skills", count: skills }]
      : []),
  ];
}

export function KillButton({
  name,
  kills,
  disabled,
  onClick,
}: {
  name: string;
  kills: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Log a kill for ${name}, ${kills} so far`}
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-11 shrink-0 items-center gap-1.5 border border-strong bg-transparent pl-2.5 pr-2 text-xs font-bold text-ink disabled:opacity-50"
    >
      <Crosshair className="h-[15px] w-[15px]" aria-hidden="true" />
      Kill
      <span
        className={cn(
          "min-w-[22px] px-1 text-center font-mono",
          kills > 0 ? "bg-accent-soft text-accent-hi" : "bg-page text-muted-foreground"
        )}
      >
        {kills}
      </span>
    </button>
  );
}

export function StatusButton({
  name,
  status,
  disabled,
  onClick,
  className,
}: {
  name: string;
  status: UnitStatus;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={`${name} status: ${STATUS_LABEL[status]}. Tap for the next`}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-between gap-2 border px-3 text-[13px] font-bold disabled:opacity-60",
        STATUS_TONE[status],
        className
      )}
    >
      {STATUS_LABEL[status]}
      <RotateCw className="h-[15px] w-[15px]" aria-hidden="true" />
    </button>
  );
}

export function WoundsControl({
  name,
  wounds,
  max,
  disabled,
  onChange,
}: {
  name: string;
  wounds: number;
  max: number;
  disabled?: boolean;
  onChange: (delta: number) => void;
}) {
  const step =
    "flex h-10 w-9 items-center justify-center border border-border bg-transparent text-text2 disabled:opacity-40";
  return (
    <div role="group" aria-label={`Wounds for ${name}`} className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Lose a wound"
        className={step}
        disabled={disabled || wounds <= 0}
        onClick={() => onChange(-1)}
      >
        <Minus className="h-[13px] w-[13px]" strokeWidth={2.25} aria-hidden="true" />
      </button>
      <span className="min-w-11 text-center font-mono text-[13px] font-bold text-ink">
        W {wounds}/{max}
      </span>
      <button
        type="button"
        aria-label="Heal a wound"
        className={step}
        disabled={disabled || wounds >= max}
        onClick={() => onChange(1)}
      >
        <Plus className="h-[13px] w-[13px]" strokeWidth={2.25} aria-hidden="true" />
      </button>
    </div>
  );
}

export function HorseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-accent-text"
    >
      <path d="M6 20V11a6 6 0 0 1 12 0v9" />
      <path d="M4 20h4" />
      <path d="M16 20h4" />
    </svg>
  );
}

export function QuickRow({
  unit,
  onOpen,
  className,
  hideEmpty,
}: {
  unit: PrebattleUnit;
  onOpen: (tab: GearTab) => void;
  className?: string;
  /** Leave out an empty Skills (a henchmen group shows only its Gear, as the board does). */
  hideEmpty?: boolean;
}) {
  return (
    <div className={cn("flex gap-1.5", className)}>
      {quickButtons(unit, hideEmpty).map((entry) => (
        <button
          key={entry.tab}
          type="button"
          onClick={() => onOpen(entry.tab)}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 border border-border bg-raised px-3 text-[13px] font-bold text-ink"
        >
          {entry.label}
          <span className="font-mono text-accent-text">{entry.count}</span>
        </button>
      ))}
    </div>
  );
}
