import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";

type PrebattleActionBarProps = {
  isSavingConfig: boolean;
  actionError: string;
  invitePending: boolean;
  battleStatus: string;
  hasCurrentParticipant: boolean;
  currentParticipantStatus?: string;
  currentUserReady: boolean;
  isUpdatingReady: boolean;
  isCancelingBattle: boolean;
  isStartingBattle: boolean;
  allParticipantsReady: boolean;
  isBattleCreator: boolean;
  canCreatorCancelBattle: boolean;
  onToggleReady: () => void;
  onOpenCreatorCancel: () => void;
  onOpenStartDialog: () => void;
};

export default function PrebattleActionBar({
  isSavingConfig,
  actionError,
  invitePending,
  battleStatus,
  hasCurrentParticipant,
  currentParticipantStatus,
  currentUserReady,
  isUpdatingReady,
  isCancelingBattle,
  isStartingBattle,
  allParticipantsReady,
  isBattleCreator,
  canCreatorCancelBattle,
  onToggleReady,
  onOpenCreatorCancel,
  onOpenStartDialog,
}: PrebattleActionBarProps) {
  const readyDisabled =
    invitePending ||
    isUpdatingReady ||
    battleStatus !== "prebattle" ||
    !hasCurrentParticipant ||
    currentParticipantStatus === "accepted" ||
    currentParticipantStatus === "canceled_prebattle";

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+3.8rem)] z-20 px-3 min-[960px]:bottom-4 min-[960px]:left-auto min-[960px]:right-4 min-[960px]:inset-x-auto min-[960px]:w-[520px]">
      <CardBackground className="space-y-2 p-3">
        {isSavingConfig ? (
          <p className="text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground">
            Saving unit config...
          </p>
        ) : null}
        {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onToggleReady} disabled={readyDisabled}>
            {isUpdatingReady ? "Updating..." : currentUserReady ? "Undo Ready" : "Ready Up"}
          </Button>
          {canCreatorCancelBattle ? (
            <Button variant="destructive" onClick={onOpenCreatorCancel} disabled={isCancelingBattle}>
              Cancel battle
            </Button>
          ) : null}
          {isBattleCreator ? (
            <Button
              variant="default"
              onClick={onOpenStartDialog}
              disabled={!allParticipantsReady || battleStatus !== "prebattle" || isStartingBattle}
            >
              Start Battle
            </Button>
          ) : null}
        </div>
      </CardBackground>
    </div>
  );
}
