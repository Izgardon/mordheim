import type { ReactNode } from "react";

import { KillTrophyIcon, OutOfActionIcon } from "./ActiveBattleActionIcons";

// Every action is a 44 px touch target (BATL-UX-05): the cards are tapped on a phone at the table.
const WOUND_BUTTON_CLASS =
  "icon-button flex h-11 w-11 items-center justify-center text-base text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
const WOUND_VALUE_CLASS =
  "flex h-11 min-w-9 items-center justify-center border-x border-border/50 px-2 text-xs font-semibold text-foreground";
export const DANGER_ACTION_BUTTON_CLASS =
  "battle-toolbar-button icon-button flex h-11 w-11 items-center justify-center rounded-md text-red-400/85 transition hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50";
export const BACK_IN_ACTION_BUTTON_CLASS =
  "battle-toolbar-button icon-button flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
const DANGER_KILL_BUTTON_CLASS =
  "battle-toolbar-button icon-button inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2 text-red-400/85 transition hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50";
const META_LABEL_CLASS =
  "text-center text-[0.5rem] uppercase tracking-[0.16em] text-muted-foreground";

/** A unit's current wounds with − and + (each change saves). */
export function ActiveWoundStepper({
  name,
  value,
  className,
  prefix,
  decreaseDisabled,
  increaseDisabled,
  onAdjust,
}: {
  name: string;
  value: number;
  className: string;
  prefix?: ReactNode;
  decreaseDisabled: boolean;
  increaseDisabled: boolean;
  onAdjust: (delta: number) => void;
}) {
  return (
    <div className={className}>
      {prefix}
      <button
        type="button"
        className={WOUND_BUTTON_CLASS}
        onClick={() => onAdjust(-1)}
        disabled={decreaseDisabled}
        aria-label={`Decrease wounds for ${name}`}
      >
        -
      </button>
      <div className={WOUND_VALUE_CLASS}>{value}</div>
      <button
        type="button"
        className={WOUND_BUTTON_CLASS}
        onClick={() => onAdjust(1)}
        disabled={increaseDisabled}
        aria-label={`Increase wounds for ${name}`}
      >
        +
      </button>
    </div>
  );
}

/** Record kill, with the unit's kills so far. */
export function ActiveKillButton({
  name,
  killCount,
  disabled,
  title,
  onClick,
}: {
  name: string;
  killCount: number;
  disabled: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={DANGER_KILL_BUTTON_CLASS}
      onClick={onClick}
      disabled={disabled}
      aria-label={`Record kill for ${name}, ${killCount} so far`}
      title={title}
    >
      <KillTrophyIcon className="h-5 w-5" />
      <span className="text-xs font-semibold">{killCount}</span>
    </button>
  );
}

/** A hero's or hired sword's actions: Wounds, OOA and Kills, each under its label. */
export function ActiveUnitActions({
  name,
  woundsValue,
  killCount,
  canAct,
  outOfActionDisabled,
  onAdjustWounds,
  onSetOutOfAction,
  onRecordKill,
}: {
  name: string;
  woundsValue: number;
  killCount: number;
  /** False while the unit can't be changed (not yours, out of action, its save pending). */
  canAct: boolean;
  outOfActionDisabled: boolean;
  onAdjustWounds: (delta: number) => void;
  onSetOutOfAction: () => void;
  onRecordKill: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="space-y-1">
        <p className={META_LABEL_CLASS}>Wounds</p>
        <ActiveWoundStepper
          name={name}
          value={woundsValue}
          className="battle-metric-box inline-flex items-center overflow-hidden rounded-md"
          decreaseDisabled={!canAct || woundsValue <= 0}
          increaseDisabled={!canAct}
          onAdjust={onAdjustWounds}
        />
      </div>
      <div className="space-y-1">
        <p className={META_LABEL_CLASS}>OOA</p>
        <button
          type="button"
          className={DANGER_ACTION_BUTTON_CLASS}
          onClick={onSetOutOfAction}
          disabled={outOfActionDisabled}
          aria-label={`Set ${name} out of action`}
        >
          <OutOfActionIcon className="h-5 w-5 text-red-400" />
        </button>
      </div>
      <div className="space-y-1">
        <p className={META_LABEL_CLASS}>Kills</p>
        <ActiveKillButton
          name={name}
          killCount={killCount}
          disabled={!canAct}
          onClick={onRecordKill}
        />
      </div>
    </div>
  );
}
