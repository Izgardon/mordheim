import { Crosshair, Minus, Plus, RotateCw } from "lucide-react";

import { StatStrip } from "@/components/ui/stat-strip";
import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import { cn } from "@/lib/utils";

import { STATUS_LABEL, statValues, type BattleUnitView, type UnitStatus } from "./battle-units";

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

function HorseIcon() {
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

type UnitCardProps = {
  view: BattleUnitView;
  /** "Champion · hired sword": the type line under the name. */
  typeLine: string;
  canAct: boolean;
  saving: boolean;
  /** Left out for a temporary unit or a pet: a killer is always one of the warband's own. */
  onKill?: () => void;
  onCycle: () => void;
  onWounds: (delta: number) => void;
  onDismount: (dismounted: boolean) => void;
  onOpen: (tab: GearTab) => void;
};

/**
 * One of your units in the fight (design E): name and type, the kill button (heroes and hired
 * swords only), the profile (hidden while out of action), the mount line with its Dismounted
 * switch, the status button that cycles beside the wounds, and Gear and Skills or Spells.
 */
export default function UnitCard({
  view,
  typeLine,
  canAct,
  saving,
  onKill,
  onCycle,
  onWounds,
  onDismount,
  onOpen,
}: UnitCardProps) {
  const { unit, status } = view;
  const out = status === "out_of_action";
  return (
    <article
      aria-label={unit.displayName}
      className={cn(
        "flex flex-col gap-[9px] border bg-surface px-3 py-[11px]",
        out ? "border-danger-line" : "border-border"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className="m-0 font-display text-[17px] font-semibold text-head">
            {unit.displayName}
          </h3>
          <span className="text-xs text-muted-foreground">{typeLine}</span>
        </div>
        {onKill ? (
          <KillButton
            name={unit.displayName}
            kills={view.kills}
            disabled={!canAct || out}
            onClick={onKill}
          />
        ) : null}
      </div>
      {out ? null : <StatStrip values={statValues(view.stats)} highlighted={view.highlighted} />}
      {view.mount ? (
        <div className="flex items-center justify-between gap-2.5">
          <span className="flex items-center gap-2 text-[13px]">
            <HorseIcon />
            <span
              className={cn("font-bold", view.dismounted ? "text-muted-foreground" : "text-ink")}
            >
              {view.dismounted ? "On foot" : `On a ${view.mount}`}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={view.dismounted}
            disabled={!canAct || out}
            onClick={() => onDismount(!view.dismounted)}
            className="flex min-h-11 items-center gap-2 pl-2 pr-0.5 text-xs font-semibold text-text2 disabled:opacity-50"
          >
            Dismounted
            <span
              aria-hidden="true"
              className={cn(
                "flex h-[22px] w-10 border border-strong p-0.5",
                view.dismounted ? "justify-end bg-primary" : "justify-start bg-page"
              )}
            >
              <span
                className={cn("h-4 w-4", view.dismounted ? "bg-on-accent" : "bg-muted-foreground")}
              />
            </span>
          </button>
        </div>
      ) : null}
      <div className="flex items-center gap-1.5">
        <StatusButton
          name={unit.displayName}
          status={status}
          disabled={!canAct || saving}
          onClick={onCycle}
        />
        <WoundsControl
          name={unit.displayName}
          wounds={view.wounds}
          max={view.maxWounds}
          disabled={!canAct || out || saving}
          onChange={onWounds}
        />
      </div>
      <QuickRow unit={unit} onOpen={onOpen} />
    </article>
  );
}
