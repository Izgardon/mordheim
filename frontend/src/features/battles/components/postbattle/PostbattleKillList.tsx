import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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

type PostbattleKillListProps = {
  unitKey: string;
  unitName: string;
  unitKind: "hero" | "hireling" | "henchman";
  /** The unit's kills that still count, oldest first: the number finalise applies. */
  kills: BattleEvent[];
  /** Who a kill took out ("Player's Black Fang", or the name typed). */
  victimName: (kill: BattleEvent) => string;
  killTargetOptions: ActiveBattleUnitOption[];
  disabled: boolean;
  onAddKill: (unitKey: string, payload: KillPayload) => Promise<void>;
  onUndoKill: (eventId: number) => Promise<void>;
};

const earnsNoXp = (kill: BattleEvent) =>
  kill.type === "unit_kill_recorded" && kill.payload_json?.earned_xp === false;

/**
 * A unit's kills in postbattle, by who was taken out (BATL-NEW-06, decision 5): each can be
 * removed (undone, kept in the battle log), and one can be added with a victim from the other
 * rosters or a typed name. The list is the number finalise applies.
 */
export default function PostbattleKillList({
  unitKey,
  unitName,
  unitKind,
  kills,
  victimName,
  killTargetOptions,
  disabled,
  onAddKill,
  onUndoKill,
}: PostbattleKillListProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [removing, setRemoving] = useState<BattleEvent | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const removingVictim = removing ? victimName(removing) : "";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Kills{" "}
          <output className="text-foreground" aria-label={`${unitName}'s kills`}>
            {kills.length}
          </output>
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-11"
          disabled={disabled}
          onClick={() => setIsAddOpen(true)}
          aria-label={`Add a kill for ${unitName}`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add kill
        </Button>
      </div>
      {kills.length > 0 ? (
        <ul className="space-y-1" aria-label={`Kills by ${unitName}`}>
          {kills.map((kill) => {
            const victim = victimName(kill);
            return (
              <li
                key={kill.id}
                className="battle-chip flex min-h-11 items-center justify-between gap-2 pl-3 text-sm"
              >
                <span className="min-w-0 text-foreground">
                  took out {victim}
                  {earnsNoXp(kill) ? (
                    <span className="text-xs text-muted-foreground"> (no XP)</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="icon-button flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={disabled}
                  onClick={() => setRemoving(kill)}
                  aria-label={`Remove ${unitName}'s kill of ${victim}`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove kill"
        description={`Remove ${unitName}'s kill of ${removingVictim}? It stays in the battle log, marked undone.`}
        confirmText={isRemoving ? "Removing..." : "Remove kill"}
        isConfirming={isRemoving}
        onConfirm={async () => {
          if (!removing) return;
          setIsRemoving(true);
          try {
            await onUndoKill(removing.id);
            setRemoving(null);
          } catch {
            // The hook shows why; the dialog stays open to retry.
          } finally {
            setIsRemoving(false);
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
