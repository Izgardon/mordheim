import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BattleParticipantStatus, BattleState } from "@/features/battles/types/battle-types";
import { deadlineLabel } from "@/features/battles/utils/battle-timing";

function getInviteStatusLabel(status: BattleParticipantStatus) {
  if (status === "accepted") {
    return "Accepted";
  }
  if (status === "invited") {
    return "Invited";
  }
  return status.replace(/_/g, " ");
}

type BattleInviteStatusDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  battleState: BattleState;
  canCancelBattle: boolean;
  canAcceptInvite: boolean;
  isAcceptingInvite: boolean;
  inviteActionError: string;
  onAcceptInvite: () => void;
  onCancelBattle: () => void;
  cancelBattleError: string;
  canDeclineInvite: boolean;
  onDeclineInvite: () => void;
};

/** A battle still inviting: who has accepted, with Accept, Decline or Cancel as they apply. */
export default function BattleInviteStatusDialog({
  open,
  onOpenChange,
  battleState,
  canCancelBattle,
  canAcceptInvite,
  isAcceptingInvite,
  inviteActionError,
  onAcceptInvite,
  onCancelBattle,
  cancelBattleError,
  canDeclineInvite,
  onDeclineInvite,
}: BattleInviteStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Battle Status</DialogTitle>
          <DialogDescription>
            Waiting for all participants to accept before prebattle opens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
            {[
              battleState.battle.scenario || `Session #${battleState.battle.id}`,
              deadlineLabel(battleState.battle),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="rounded-xl border border-border/50 bg-black/30">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-black/35">
                  <th className="px-3 py-2 text-left text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">
                    Participant
                  </th>
                  <th className="px-3 py-2 text-right text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {battleState.participants.map((participant) => (
                  <tr key={participant.id} className="border-b border-border/30 last:border-b-0">
                    <td className="px-3 py-2">
                      <p className="text-sm font-semibold text-foreground">
                        {participant.user.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{participant.warband.name}</p>
                    </td>
                    <td className="px-3 py-2 text-right text-[0.62rem] uppercase tracking-[0.17em] text-amber-300">
                      {getInviteStatusLabel(participant.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {inviteActionError ? <p className="text-sm text-red-600">{inviteActionError}</p> : null}
          {cancelBattleError ? <p className="text-sm text-red-600">{cancelBattleError}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          {canAcceptInvite ? (
            <Button variant="default" onClick={onAcceptInvite} disabled={isAcceptingInvite}>
              {isAcceptingInvite ? "Accepting..." : "Accept invite"}
            </Button>
          ) : null}
          {canDeclineInvite ? (
            <Button variant="secondary" onClick={onDeclineInvite}>
              Decline
            </Button>
          ) : null}
          {canCancelBattle ? (
            <Button variant="destructive" onClick={onCancelBattle}>
              Cancel battle
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
