import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";

type PrebattleInviteGateProps = {
  canAcceptInvite: boolean;
  isAcceptingInvite: boolean;
  waitingForOthers: boolean;
  canCreatorCancelBattle: boolean;
  isCancelingBattle: boolean;
  onAcceptInvite: () => void;
  onOpenCancelBattle: () => void;
};

export default function PrebattleInviteGate({
  canAcceptInvite,
  isAcceptingInvite,
  waitingForOthers,
  canCreatorCancelBattle,
  isCancelingBattle,
  onAcceptInvite,
  onOpenCancelBattle,
}: PrebattleInviteGateProps) {
  return (
    <CardBackground className="space-y-3 bg-[#18120d] p-3 sm:p-5">
      <p className="text-sm text-muted-foreground">
        Prebattle opens only after all invited participants accept.
      </p>
      {canAcceptInvite ? (
        <Button onClick={onAcceptInvite} disabled={isAcceptingInvite}>
          {isAcceptingInvite ? "Accepting..." : "Accept invitation"}
        </Button>
      ) : waitingForOthers ? (
        <p className="text-sm text-amber-300">Accepted. Waiting for remaining participants...</p>
      ) : null}
      {canCreatorCancelBattle ? (
        <Button variant="destructive" onClick={onOpenCancelBattle} disabled={isCancelingBattle}>
          Cancel battle
        </Button>
      ) : null}
    </CardBackground>
  );
}
