import { Crosshair, Minus, NotebookPen, Plus, RotateCw } from "lucide-react";

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
  compact = false,
}: {
  name: string;
  wounds: number;
  max: number;
  disabled?: boolean;
  onChange: (delta: number) => void;
  /** A henchman's tile: smaller steps either side of the count, across the tile. */
  compact?: boolean;
}) {
  const step = cn(
    "flex items-center justify-center border border-border bg-transparent text-text2 disabled:opacity-40",
    compact ? "h-8 w-8" : "h-10 w-9"
  );
  return (
    <div
      role="group"
      aria-label={`Wounds for ${name}`}
      className={cn("flex items-center gap-1", compact && "justify-between")}
    >
      <button
        type="button"
        aria-label={compact ? `${name} loses a wound` : "Lose a wound"}
        className={step}
        disabled={disabled || wounds <= 0}
        onClick={() => onChange(-1)}
      >
        <Minus className="h-[13px] w-[13px]" strokeWidth={2.25} aria-hidden="true" />
      </button>
      <span
        className={cn(
          "text-center font-mono font-bold text-ink",
          compact ? "text-[11px]" : "min-w-11 text-[13px]"
        )}
      >
        W {wounds}/{max}
      </span>
      <button
        type="button"
        aria-label={compact ? `${name} heals a wound` : "Heal a wound"}
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

/** A unit's battle note, behind a small button at the end of its card's bottom row. */
export type CardNote = { text: string; onOpen: () => void };

function NoteButton({ name, note }: { name: string; note: CardNote }) {
  const has = Boolean(note.text.trim());
  return (
    <button
      type="button"
      aria-label={has ? `Note for ${name}: ${note.text}` : `Add a note for ${name}`}
      title={has ? note.text : "Add a note"}
      onClick={note.onOpen}
      className={cn(
        "relative flex min-h-11 w-11 shrink-0 items-center justify-center border",
        has
          ? "border-accent-line bg-accent-soft text-accent-hi"
          : "border-border text-muted-foreground"
      )}
    >
      <NotebookPen className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export function QuickRow({
  unit,
  onOpen,
  className,
  hideEmpty,
  note,
}: {
  unit: PrebattleUnit;
  onOpen: (tab: GearTab) => void;
  className?: string;
  /** Leave out an empty Skills (a henchmen group shows only its Gear, as the board does). */
  hideEmpty?: boolean;
  /** Your own unit's battle note (left out for anyone else's). */
  note?: CardNote;
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
      {note ? <NoteButton name={unit.displayName} note={note} /> : null}
    </div>
  );
}

/** The first line of a unit's battle note under its card's bottom row; a tap opens it. */
export function NotePreview({ text, onOpen }: { text: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-hidden="true"
      tabIndex={-1}
      className="-mt-1 truncate text-left text-xs italic text-text2"
    >
      {text}
    </button>
  );
}
