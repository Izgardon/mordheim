import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type PrebattleInviteGateProps = {
  canAcceptInvite: boolean;
  isAcceptingInvite: boolean;
  waitingForOthers: boolean;
  canCreatorCancelBattle: boolean;
  isCancelingBattle: boolean;
  onAcceptInvite: () => void;
  onOpenCancelBattle: () => void;
  /** An invitee can decline until the battle starts (BUG-45). */
  canDeclineInvite?: boolean;
  isDecliningInvite?: boolean;
  declineError?: string;
  onDeclineInvite?: () => void;
};

export const DECLINE_INVITE_QUESTION =
  "Decline this battle? You can't rejoin it, and with fewer than two players left it is cancelled.";

export default function PrebattleInviteGate({
  canAcceptInvite,
  isAcceptingInvite,
  waitingForOthers,
  canCreatorCancelBattle,
  isCancelingBattle,
  onAcceptInvite,
  onOpenCancelBattle,
  canDeclineInvite = false,
  isDecliningInvite = false,
  declineError = "",
  onDeclineInvite,
}: PrebattleInviteGateProps) {
  const [isDeclineOpen, setIsDeclineOpen] = useState(false);
  return (
    <CardBackground className="space-y-3 p-3 sm:p-5">
      <p className="text-sm text-muted-foreground">
        Prebattle opens only after all invited participants accept.
      </p>
      {canAcceptInvite ? (
        <Button onClick={onAcceptInvite} disabled={isAcceptingInvite || isDecliningInvite}>
          {isAcceptingInvite ? "Accepting..." : "Accept invitation"}
        </Button>
      ) : waitingForOthers ? (
        <p className="text-sm text-amber-300">Accepted. Waiting for remaining participants...</p>
      ) : null}
      {canDeclineInvite ? (
        <Button
          variant="secondary"
          className="ml-2"
          onClick={() => setIsDeclineOpen(true)}
          disabled={isAcceptingInvite || isDecliningInvite}
        >
          Decline
        </Button>
      ) : null}
      {canCreatorCancelBattle ? (
        <Button variant="destructive" onClick={onOpenCancelBattle} disabled={isCancelingBattle}>
          Cancel battle
        </Button>
      ) : null}
      <ConfirmDialog
        open={isDeclineOpen}
        onOpenChange={setIsDeclineOpen}
        title="Decline battle"
        description={
          <div className="space-y-2">
            <p>{DECLINE_INVITE_QUESTION}</p>
            {declineError ? <p className="text-sm text-red-600">{declineError}</p> : null}
          </div>
        }
        confirmText={isDecliningInvite ? "Declining..." : "Decline"}
        isConfirming={isDecliningInvite}
        onConfirm={() => onDeclineInvite?.()}
      />
    </CardBackground>
  );
}
