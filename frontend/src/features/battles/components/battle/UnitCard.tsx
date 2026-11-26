import { StatStrip } from "@/components/ui/stat-strip";
import { cn } from "@/lib/utils";

import { statValues, type BattleUnitView } from "./battle-units";
import {
  HorseIcon,
  KillButton,
  NotePreview,
  QuickRow,
  StatusButton,
  StatusReadout,
  WoundsControl,
  type GearTab,
} from "./UnitCardParts";

/**
 * What a card may do to the unit it shows. Left out for another warband's unit: everything about it
 * is visible, nothing is editable (William, 12 Nov 2026).
 */
export type UnitCardActions = {
  canAct: boolean;
  saving: boolean;
  /** Left out for a temporary unit or a pet: a killer is always one of the warband's own. */
  onKill?: () => void;
  onCycle: () => void;
  onWounds: (delta: number) => void;
  onDismount: (dismounted: boolean) => void;
  /** Opens the unit's battle note (yours only). */
  onNote: () => void;
};

type UnitCardProps = {
  view: BattleUnitView;
  /** "Champion · hired sword": the type line under the name. */
  typeLine: string;
  /** His status changed a moment ago: the card and its status row are marked briefly. */
  recent?: boolean;
  onOpen: (tab: GearTab) => void;
  actions?: UnitCardActions;
};

/**
 * A unit in the fight (design E): name and type, the kill button (heroes and hired swords only),
 * the profile (hidden while out of action), the mount line with its Dismounted switch, the status
 * button that cycles beside the wounds, Gear and Skills or Spells, and the small Note button for
 * your battle note on it (its first line under the row when it has one).
 *
 * Another warband's unit (no `actions`) shows the same profile, mount, gear, skills and rules, with
 * its status and wounds as text and no control that changes anything.
 *
 * `recent` marks the model and its status row for a moment after the status changes (William, 12
 * Nov 2026); the mark clears itself, whoever changed it.
 */
export default function UnitCard({ view, typeLine, recent, onOpen, actions }: UnitCardProps) {
  const { unit, status } = view;
  const out = status === "out_of_action";
  const note = view.info?.notes?.trim() ?? "";
  return (
    <article
      aria-label={unit.displayName}
      className={cn(
        "flex flex-col gap-[9px] border bg-surface px-3 py-[11px]",
        out ? "border-danger-line" : "border-border",
        recent && "status-flash"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="m-0 font-display text-[17px] font-semibold text-head">
            {unit.displayName}
          </h3>
          <span className="text-xs text-muted-foreground">{typeLine}</span>
        </div>
        {actions?.onKill ? (
          <KillButton
            name={unit.displayName}
            kills={view.kills}
            disabled={!actions.canAct || out}
            onClick={actions.onKill}
          />
        ) : null}
      </div>
      {out ? null : (
        <StatStrip values={statValues(view.stats, view.written)} highlighted={view.highlighted} />
      )}
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
          {actions ? (
            <button
              type="button"
              role="switch"
              // on while he rides, "Mounted"; off, "Dismounted" (William, 25 Nov 2026)
              aria-checked={!view.dismounted}
              disabled={!actions.canAct || out}
              onClick={() => actions.onDismount(!view.dismounted)}
              className="flex min-h-11 items-center gap-2 pl-2 pr-0.5 text-xs font-semibold text-text2 disabled:opacity-50"
            >
              {view.dismounted ? "Dismounted" : "Mounted"}
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-[22px] w-10 border border-strong p-0.5",
                  view.dismounted ? "justify-start bg-page" : "justify-end bg-primary"
                )}
              >
                <span
                  className={cn(
                    "h-4 w-4",
                    view.dismounted ? "bg-muted-foreground" : "bg-on-accent"
                  )}
                />
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
      {actions ? (
        <div className={cn("flex items-center gap-1.5", recent && "status-flash")}>
          <StatusButton
            name={unit.displayName}
            status={status}
            disabled={!actions.canAct || actions.saving}
            onClick={actions.onCycle}
          />
          <WoundsControl
            name={unit.displayName}
            wounds={view.wounds}
            max={view.maxWounds}
            disabled={!actions.canAct || out || actions.saving}
            onChange={actions.onWounds}
          />
        </div>
      ) : (
        <StatusReadout
          status={status}
          wounds={view.wounds}
          max={view.maxWounds}
          className={recent ? "status-flash" : undefined}
        />
      )}
      <QuickRow
        unit={unit}
        onOpen={onOpen}
        note={actions ? { text: note, onOpen: actions.onNote } : undefined}
      />
      {note && actions ? <NotePreview text={note} onOpen={actions.onNote} /> : null}
    </article>
  );
}
