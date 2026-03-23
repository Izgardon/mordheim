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
  approveReportedBattleResult,
  cancelBattleAsCreator,
  declineReportedBattleResult,
  joinBattle,
  listCampaignBattles,
} from "@/features/battles/api/battles-api";
import type {
  BattleParticipantStatus,
  BattleState,
  BattleSummary,
  BattleStatus,
} from "@/features/battles/types/battle-types";
import type { CampaignPlayer } from "../../types/campaign-types";
import StartBattleDialog from "./StartBattleDialog";

type BattleActionPanelProps = {
  campaignId: number;
  players: CampaignPlayer[];
  campaignStarted: boolean;
};

export default function BattleActionPanel({
  campaignId,
  players,
  campaignStarted,
}: BattleActionPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isStartBattleOpen, setIsStartBattleOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isCancelBattleDialogOpen, setIsCancelBattleDialogOpen] = useState(false);
  const [isCancelingBattle, setIsCancelingBattle] = useState(false);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [pendingActionBattleId, setPendingActionBattleId] = useState<number | null>(null);
  const [reportedResultActionError, setReportedResultActionError] = useState("");
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
    const handleBattleResultRequest = () => void refreshBattleStates();
    const handlePrebattleOpened = () => void refreshBattleStates();
    const handleBattleStatusUpdated = () => void refreshBattleStates();
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("online", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("battle:invite", handleBattleInvite as EventListener);
    window.addEventListener("battle:result-request", handleBattleResultRequest as EventListener);
    window.addEventListener("battle:prebattle-opened", handlePrebattleOpened as EventListener);
    window.addEventListener("battle:status-updated", handleBattleStatusUpdated as EventListener);
    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("online", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("battle:invite", handleBattleInvite as EventListener);
      window.removeEventListener("battle:result-request", handleBattleResultRequest as EventListener);
      window.removeEventListener("battle:prebattle-opened", handlePrebattleOpened as EventListener);
      window.removeEventListener("battle:status-updated", handleBattleStatusUpdated as EventListener);
    };
  }, [refreshBattleStates]);

  const resumableBattle = useMemo(
    () =>
      battleStates.find(
        (state) => {
          if (state.battle.flow_type !== "normal") {
            return false;
          }
          if (state.battle.status === "ended" || state.battle.status === "canceled") {
            return false;
          }
          const participant = state.participants.find(
            (entry) => entry.user.id === user?.id
          );
          return (
            participant?.status !== "confirmed_postbattle" &&
            participant?.status !== "canceled_prebattle"
          );
        }
      ) ?? null,
    [battleStates, user?.id]
  );

  const reportedResultBattles = useMemo(
    () =>
      battleStates.filter(
        (state) =>
          state.battle.flow_type === "reported_result" &&
          state.battle.status === "reported_result_pending"
      ),
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

  const handleApproveReportedResult = async (battleId: number) => {
    setReportedResultActionError("");
    setPendingActionBattleId(battleId);
    try {
      const updatedBattle = await approveReportedBattleResult(campaignId, battleId);
      setBattleStates((prev) =>
        prev.map((entry) => (entry.battle.id === updatedBattle.battle.id ? updatedBattle : entry))
      );
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setReportedResultActionError(errorResponse.message || "Unable to approve reported result");
      } else {
        setReportedResultActionError("Unable to approve reported result");
      }
    } finally {
      setPendingActionBattleId(null);
    }
  };

  const handleDeclineReportedResult = async (battleId: number) => {
    setReportedResultActionError("");
    setPendingActionBattleId(battleId);
    try {
      const updatedBattle = await declineReportedBattleResult(campaignId, battleId);
      setBattleStates((prev) =>
        prev.map((entry) => (entry.battle.id === updatedBattle.battle.id ? updatedBattle : entry))
      );
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setReportedResultActionError(errorResponse.message || "Unable to decline reported result");
      } else {
        setReportedResultActionError("Unable to decline reported result");
      }
    } finally {
      setPendingActionBattleId(null);
    }
  };

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
      <div className="flex flex-wrap justify-center gap-2 px-2 sm:px-0">
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
        ) : campaignStarted ? (
          <Button variant="default" disabled={isBattlesLoading} onClick={() => setIsStartBattleOpen(true)}>
            Start battle
          </Button>
        ) : null}
        {campaignStarted ? (
          <StartBattleDialog
            open={isStartBattleOpen}
            onOpenChange={setIsStartBattleOpen}
            campaignId={campaignId}
            creatorUserId={user?.id ?? 0}
            players={players}
            onBattleCreated={refreshBattleStates}
          />
        ) : null}
      </div>

      {battleError ? <p className="text-center text-sm text-red-600">{battleError}</p> : null}
      {reportedResultActionError ? (
        <p className="text-center text-sm text-red-600">{reportedResultActionError}</p>
      ) : null}

      {reportedResultBattles.length > 0 ? (
        <div className="mx-auto max-w-3xl space-y-3 px-2 sm:px-0">
          {reportedResultBattles.map((state) => (
            <ReportedResultPendingCard
              key={state.battle.id}
              battleState={state}
              currentUserId={user?.id ?? 0}
              isPending={pendingActionBattleId === state.battle.id}
              onApprove={() => void handleApproveReportedResult(state.battle.id)}
              onDecline={() => void handleDeclineReportedResult(state.battle.id)}
            />
          ))}
        </div>
      ) : null}

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

function getReportedResultLabel(battle: BattleSummary, participantStatus: BattleParticipantStatus | null) {
  const winnerCount = (battle.winner_warband_ids_json ?? []).length;
  const baseLabel = winnerCount === 1 ? "Winner declared" : "Winners declared";
  if (participantStatus === "reported_result_pending") {
    return `${baseLabel} - waiting for your approval`;
  }
  if (participantStatus === "reported_result_approved") {
    return `${baseLabel} - you approved`;
  }
  return baseLabel;
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

type ReportedResultPendingCardProps = {
  battleState: BattleState;
  currentUserId: number;
  isPending: boolean;
  onApprove: () => void;
  onDecline: () => void;
};

function ReportedResultPendingCard({
  battleState,
  currentUserId,
  isPending,
  onApprove,
  onDecline,
}: ReportedResultPendingCardProps) {
  const currentParticipant =
    battleState.participants.find((participant) => participant.user.id === currentUserId) ?? null;
  const currentStatus = currentParticipant?.status ?? null;
  const winnerIds = new Set(battleState.battle.winner_warband_ids_json ?? []);
  const winners = battleState.participants
    .filter((participant) => winnerIds.has(participant.warband.id))
    .map((participant) => participant.warband.name);
  const participants = battleState.participants.map((participant) => participant.warband.name);
  const awaitingParticipants = battleState.participants
    .filter((participant) => participant.status === "reported_result_pending")
    .map((participant) => participant.user.label);
  const canRespond = currentStatus === "reported_result_pending";

  return (
    <div className="rounded-xl border border-border/50 bg-black/25 p-3">
      <div className="space-y-1">
        <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
          Reported Battle Result
        </p>
        <p className="text-sm font-semibold text-foreground">
          {getReportedResultLabel(battleState.battle, currentStatus)}
        </p>
        <p className="text-sm text-muted-foreground">Participants: {participants.join(", ")}</p>
        <p className="text-sm text-muted-foreground">
          Winners: {winners.length > 0 ? winners.join(", ") : "-"}
        </p>
        {awaitingParticipants.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Awaiting: {awaitingParticipants.join(", ")}
          </p>
        ) : null}
      </div>
      {canRespond ? (
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" disabled={isPending} onClick={onDecline}>
            {isPending ? "Working..." : "Decline"}
          </Button>
          <Button variant="default" disabled={isPending} onClick={onApprove}>
            {isPending ? "Working..." : "Approve"}
          </Button>
        </div>
      ) : null}
    </div>
  );
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
                      <p className="text-sm font-semibold text-foreground">{participant.user.label}</p>
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
