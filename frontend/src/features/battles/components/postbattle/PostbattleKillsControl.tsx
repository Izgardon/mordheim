import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import ActiveKillDialog from "@/features/battles/components/active/ActiveKillDialog";
import type { ActiveBattleUnitOption } from "@/features/battles/components/active/active-utils";
import type { BattleEvent } from "@/features/battles/types/battle-types";

type KillPayload = {
  victimUnitKey?: string;
  victimName?: string;
  notes?: string;
  earnedXp: boolean;
};

type PostbattleKillsControlProps = {
  unitKey: string;
  unitName: string;
  unitKind: "hero" | "hired_sword" | "henchman";
  /** The unit's kills that still count, oldest first: the number finalise applies. */
  kills: BattleEvent[];
  killTargetOptions: ActiveBattleUnitOption[];
  disabled: boolean;
  onAddKill: (unitKey: string, payload: KillPayload) => Promise<void>;
  onUndoKill: (eventId: number) => Promise<void>;
};

const victimOf = (event: BattleEvent | undefined) => {
  const victim = (event?.payload_json as { victim?: { name?: unknown } } | undefined)?.victim;
  return typeof victim?.name === "string" && victim.name.trim() ? victim.name.trim() : null;
};

const STEP_CLASS =
  "icon-button flex h-10 w-10 items-center justify-center border border-border/60 text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

/**
 * A unit's kills in postbattle (BUG-11, decision 5): the count is the kills that still count.
 * Minus undoes the latest one, Plus records one more (who was taken out), so the number shown is
 * the number finalise applies. The list of kills by victim is PR C.
 */
export default function PostbattleKillsControl({
  unitKey,
  unitName,
  unitKind,
  kills,
  killTargetOptions,
  disabled,
  onAddKill,
  onUndoKill,
}: PostbattleKillsControlProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isUndoOpen, setIsUndoOpen] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const latest = kills[kills.length - 1];
  const latestVictim = victimOf(latest);

  return (
    <div className="space-y-1">
      <span className="block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Kills
      </span>
      <div className="flex items-center">
        <button
          type="button"
          className={STEP_CLASS}
          onClick={() => setIsUndoOpen(true)}
          disabled={disabled || !latest}
          aria-label={`Undo ${unitName}'s latest kill`}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <output
          className="flex h-10 min-w-10 items-center justify-center border-y border-border/60 px-2 text-sm font-semibold text-foreground"
          aria-label={`${unitName}'s kills`}
        >
          {kills.length}
        </output>
        <button
          type="button"
          className={STEP_CLASS}
          onClick={() => setIsAddOpen(true)}
          disabled={disabled}
          aria-label={`Add a kill for ${unitName}`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <ConfirmDialog
        open={isUndoOpen}
        onOpenChange={setIsUndoOpen}
        title="Undo kill"
        description={`Undo ${unitName}'s latest kill${latestVictim ? ` (took out ${latestVictim})` : ""}? It stays in the battle log, marked undone.`}
        confirmText={isUndoing ? "Undoing..." : "Undo kill"}
        isConfirming={isUndoing}
        onConfirm={async () => {
          if (!latest) return;
          setIsUndoing(true);
          try {
            await onUndoKill(latest.id);
            setIsUndoOpen(false);
          } catch {
            // The hook shows why; the dialog stays open to retry.
          } finally {
            setIsUndoing(false);
          }
        }}
      />
      {isAddOpen ? (
        <ActiveKillDialog
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          killerName={unitName}
          killerUnitKey={unitKey}
          showEarnedXpOption
          defaultEarnedXp={unitKind !== "henchman"}
          options={killTargetOptions}
          onConfirm={(payload) => onAddKill(unitKey, payload)}
        />
      ) : null}
    </div>
  );
}
