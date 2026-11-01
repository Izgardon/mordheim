import { StatStrip } from "@/components/ui/stat-strip";
import { cn } from "@/lib/utils";

import { statValues, type BattleUnitView } from "./battle-units";
import {
  HorseIcon,
  KillButton,
  NotePreview,
  QuickRow,
  StatusButton,
  WoundsControl,
  type GearTab,
} from "./UnitCardParts";

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
  /** Opens the unit's battle note (yours only). */
  onNote: () => void;
};

/**
 * One of your units in the fight (design E): name and type, the kill button (heroes and hired
 * swords only), the profile (hidden while out of action), the mount line with its Dismounted
 * switch, the status button that cycles beside the wounds, Gear and Skills or Spells, and the
 * small Note button for your battle note on it (its first line under the row when it has one).
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
  onNote,
}: UnitCardProps) {
  const { unit, status } = view;
  const out = status === "out_of_action";
  const note = view.info?.notes?.trim() ?? "";
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
      <QuickRow unit={unit} onOpen={onOpen} note={{ text: note, onOpen: onNote }} />
      {note ? <NotePreview text={note} onOpen={onNote} /> : null}
    </article>
  );
}
