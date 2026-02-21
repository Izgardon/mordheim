import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  cancelBattleAsCreator,
  joinBattle,
  listCampaignBattles,
} from "@/features/battles/api/battles-api";
import type {
  BattleParticipantStatus,
  BattleState,
  BattleStatus,
} from "@/features/battles/types/battle-types";
import type { CampaignPlayer } from "../../types/campaign-types";
import StartBattleDialog from "./StartBattleDialog";

type BattleActionPanelProps = {
  campaignId: number;
  players: CampaignPlayer[];
};

export default function BattleActionPanel({ campaignId, players }: BattleActionPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isStartBattleOpen, setIsStartBattleOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isCancelBattleDialogOpen, setIsCancelBattleDialogOpen] = useState(false);
  const [isCancelingBattle, setIsCancelingBattle] = useState(false);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [cancelBattleError, setCancelBattleError] = useState("");
  const [inviteActionError, setInviteActionError] = useState("");
  const [battleStates, setBattleStates] = useState<BattleState[]>([]);
  const [battleError, setBattleError] = useState("");
  const [isBattlesLoading, setIsBattlesLoading] = useState(true);

  const refreshBattleStates = useCallback(async () => {
    try {
      const data = await listCampaignBattles(campaignId);
      setBattleStates(data);
      setBattleError("");
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setBattleError(errorResponse.message || "Unable to load battles");
      } else {
        setBattleError("Unable to load battles");
      }
    } finally {
      setIsBattlesLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void refreshBattleStates();
  }, [refreshBattleStates]);

  useEffect(() => {
    const handleRefresh = () => void refreshBattleStates();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshBattleStates();
      }
    };
    const handleBattleInvite = () => void refreshBattleStates();
    const handlePrebattleOpened = () => void refreshBattleStates();
    const handleBattleStatusUpdated = () => void refreshBattleStates();
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("online", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("battle:invite", handleBattleInvite as EventListener);
    window.addEventListener("battle:prebattle-opened", handlePrebattleOpened as EventListener);
    window.addEventListener("battle:status-updated", handleBattleStatusUpdated as EventListener);
    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("online", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("battle:invite", handleBattleInvite as EventListener);
      window.removeEventListener("battle:prebattle-opened", handlePrebattleOpened as EventListener);
      window.removeEventListener("battle:status-updated", handleBattleStatusUpdated as EventListener);
    };
  }, [refreshBattleStates]);

  const resumableBattle = useMemo(
    () =>
      battleStates.find(
        (state) =>
          state.battle.status !== "ended" && state.battle.status !== "canceled"
      ) ?? null,
    [battleStates]
  );

  const currentUserParticipant = useMemo(
    () =>
      resumableBattle?.participants.find(
        (participant) => participant.user.id === user?.id
      ) ?? null,
    [resumableBattle, user?.id]
  );

  const battleIsInviting = resumableBattle?.battle.status === "inviting";
  const canAcceptInvite = battleIsInviting && currentUserParticipant?.status === "invited";

  const canCreatorCancelResumableBattle =
    Boolean(resumableBattle) &&
    resumableBattle?.battle.created_by_user_id === user?.id &&
    (resumableBattle?.battle.status === "inviting" ||
      resumableBattle?.battle.status === "prebattle");

  const handleRejoinBattle = () => {
    if (!resumableBattle) {
      return;
    }
    const battleRoute = getBattleRouteForStatus(resumableBattle.battle.status);
    navigate(`/campaigns/${campaignId}/battles/${resumableBattle.battle.id}/${battleRoute}`);
  };

  const handleAcceptInvite = async () => {
    if (!resumableBattle) {
      return;
    }
    setInviteActionError("");
    setIsAcceptingInvite(true);
    try {
      const updatedBattle = await joinBattle(campaignId, resumableBattle.battle.id);
      setBattleStates((prev) =>
        prev.map((entry) =>
          entry.battle.id === updatedBattle.battle.id ? updatedBattle : entry
        )
      );
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setInviteActionError(errorResponse.message || "Unable to accept invitation");
      } else {
        setInviteActionError("Unable to accept invitation");
      }
    } finally {
      setIsAcceptingInvite(false);
    }
  };

  const handleCancelBattle = async () => {
    if (!resumableBattle) {
      return;
    }
    setCancelBattleError("");
    setIsCancelingBattle(true);
    try {
      const updatedBattle = await cancelBattleAsCreator(campaignId, resumableBattle.battle.id);
      setBattleStates((prev) =>
        prev.map((entry) =>
          entry.battle.id === updatedBattle.battle.id ? updatedBattle : entry
        )
      );
      setIsCancelBattleDialogOpen(false);
      setIsStatusDialogOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setCancelBattleError(errorResponse.message || "Unable to cancel battle");
      } else {
        setCancelBattleError("Unable to cancel battle");
      }
    } finally {
      setIsCancelingBattle(false);
    }
  };

  return (
    <>
      <div className="flex justify-center px-2 sm:px-0">
        {resumableBattle ? (
          <Button
            variant="default"
            disabled={isBattlesLoading}
            onClick={() => {
              if (battleIsInviting) {
                setIsStatusDialogOpen(true);
                return;
              }
              handleRejoinBattle();
            }}
          >
            {battleIsInviting ? "See Status" : "Rejoin Battle"}
          </Button>
        ) : (
          <Button variant="default" disabled={isBattlesLoading} onClick={() => setIsStartBattleOpen(true)}>
            Start battle
          </Button>
        )}
        <StartBattleDialog
          open={isStartBattleOpen}
          onOpenChange={setIsStartBattleOpen}
          campaignId={campaignId}
          creatorUserId={user?.id ?? 0}
          players={players}
          onBattleCreated={refreshBattleStates}
        />
      </div>

      {battleError ? <p className="text-center text-sm text-red-600">{battleError}</p> : null}

      {resumableBattle && battleIsInviting ? (
        <BattleInviteStatusDialog
          open={isStatusDialogOpen}
          onOpenChange={setIsStatusDialogOpen}
          battleState={resumableBattle}
          canCancelBattle={Boolean(canCreatorCancelResumableBattle)}
          canAcceptInvite={Boolean(canAcceptInvite)}
          isAcceptingInvite={isAcceptingInvite}
          inviteActionError={inviteActionError}
          onAcceptInvite={handleAcceptInvite}
          onCancelBattle={() => setIsCancelBattleDialogOpen(true)}
          cancelBattleError={cancelBattleError}
        />
      ) : null}

      <ConfirmDialog
        open={isCancelBattleDialogOpen}
        onOpenChange={setIsCancelBattleDialogOpen}
        description={
          <div className="space-y-2">
            <p>Cancel this battle for all participants?</p>
            <p className="text-xs text-muted-foreground">
              This can only be done before the battle starts.
            </p>
            {cancelBattleError ? <p className="text-sm text-red-600">{cancelBattleError}</p> : null}
          </div>
        }
        confirmText={isCancelingBattle ? "Canceling..." : "Cancel battle"}
        confirmVariant="destructive"
        confirmDisabled={isCancelingBattle}
        isConfirming={isCancelingBattle}
        onConfirm={handleCancelBattle}
        onCancel={() => setIsCancelBattleDialogOpen(false)}
      />
    </>
  );
}

function getBattleRouteForStatus(status: BattleStatus) {
  if (status === "active") {
    return "active";
  }
  if (status === "postbattle") {
    return "postbattle";
  }
  return "prebattle";
}

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
};

function BattleInviteStatusDialog({
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
            {battleState.battle.title || `Battle #${battleState.battle.id}`}
          </p>
          <div className="overflow-x-auto rounded-xl border border-border/50 bg-black/30">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-black/35">
                  <th className="px-3 py-2 text-left text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">
                    Player
                  </th>
                  <th className="px-3 py-2 text-left text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">
                    Warband
                  </th>
                  <th className="px-3 py-2 text-right text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">
                    Rating
                  </th>
                  <th className="px-3 py-2 text-right text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {battleState.participants.map((participant) => (
                  <tr key={participant.id} className="border-b border-border/30 last:border-b-0">
                    <td className="px-3 py-2 text-sm font-semibold text-foreground">
                      {participant.user.label}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {participant.warband.name}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {participant.declared_rating ?? "-"}
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
