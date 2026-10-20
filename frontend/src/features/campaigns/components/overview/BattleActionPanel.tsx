import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "@components/confirm-dialog";
import { useMediaQuery } from "@/lib/use-media-query";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { cancelBattleAsCreator, joinBattle } from "@/features/battles/api/battles-api";
import { DECLINE_INVITE_QUESTION } from "@/features/battles/components/prebattle/PrebattleInviteGate";
import { useDeclineInvite } from "@/features/battles/hooks/useDeclineInvite";
import { invalidatePendingResults } from "@/features/battles/hooks/usePendingReportedResults";
import {
  useOpenCampaignBattles,
  useRefreshOpenBattles,
  useReplaceOpenBattle,
} from "@/features/battles/hooks/useOpenCampaignBattles";
import type { BattleState } from "@/features/battles/types/battle-types";
import {
  getBattleRouteForStatus,
  getResumableBattleForUser,
} from "@/features/battles/utils/battle-session";
import { deadlineLabel } from "@/features/battles/utils/battle-timing";
import type { CampaignPlayer } from "../../types/campaign-types";
import UnfinishedBattleBanner from "@/features/battles/components/shared/UnfinishedBattleBanner";
import { battleButtonClass } from "../layout/RejoinBattleButton";
import RejoinBattleButton from "../layout/RejoinBattleButton";
import BattleInviteStatusDialog from "./BattleInviteStatusDialog";
import PendingResultsCard from "./PendingResultsCard";
import StartBattleButton from "./StartBattleButton";
import { getErrorMessage } from "@/lib/get-error-message";

const NO_BATTLES: BattleState[] = [];

type BattleActionPanelProps = {
  campaignId: number;
  players: CampaignPlayer[];
  campaignStarted: boolean;
  /** Shown first in the button row (Start campaign, before the start). */
  leadingAction?: ReactNode;
};

export default function BattleActionPanel({
  campaignId,
  players,
  campaignStarted,
  leadingAction,
}: BattleActionPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 960px)");

  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isCancelBattleDialogOpen, setIsCancelBattleDialogOpen] = useState(false);
  const [isCancelingBattle, setIsCancelingBattle] = useState(false);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [cancelBattleError, setCancelBattleError] = useState("");
  const [inviteActionError, setInviteActionError] = useState("");
  // Shared with the layout's Rejoin Battle button; refetches on focus, reconnect and battle events.
  const battlesQuery = useOpenCampaignBattles(campaignId);
  const battleStates = battlesQuery.data ?? NO_BATTLES;
  const battleError = battlesQuery.error
    ? getErrorMessage(battlesQuery.error, "Unable to load battles")
    : "";
  const isBattlesLoading = battlesQuery.isPending;
  const replaceOpenBattle = useReplaceOpenBattle(campaignId);
  const refreshOpenBattles = useRefreshOpenBattles(campaignId);
  const queryClient = useQueryClient();

  const resumableBattle = useMemo(
    () => getResumableBattleForUser(battleStates, user?.id),
    [battleStates, user?.id]
  );

  const currentUserParticipant = useMemo(
    () =>
      resumableBattle?.participants.find((participant) => participant.user.id === user?.id) ?? null,
    [resumableBattle, user?.id]
  );

  const battleIsInviting = resumableBattle?.battle.status === "inviting";
  const canAcceptInvite = battleIsInviting && currentUserParticipant?.status === "invited";
  const canDeclineInvite =
    battleIsInviting &&
    resumableBattle?.battle.created_by_user_id !== user?.id &&
    (currentUserParticipant?.status === "invited" || currentUserParticipant?.status === "accepted");
  const [isDeclineConfirmOpen, setIsDeclineConfirmOpen] = useState(false);
  const declining = useDeclineInvite({
    campaignId,
    battleId: resumableBattle?.battle.id ?? null,
    onDeclined: (updatedBattle) => {
      replaceOpenBattle(updatedBattle);
      void refreshOpenBattles();
      setIsDeclineConfirmOpen(false);
      setIsStatusDialogOpen(false);
    },
  });

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
      replaceOpenBattle(updatedBattle);
    } catch (errorResponse) {
      setInviteActionError(getErrorMessage(errorResponse, "Unable to accept invitation"));
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
      replaceOpenBattle(updatedBattle);
      setIsCancelBattleDialogOpen(false);
      setIsStatusDialogOpen(false);
    } catch (errorResponse) {
      setCancelBattleError(getErrorMessage(errorResponse, "Unable to cancel battle"));
    } finally {
      setIsCancelingBattle(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap justify-center gap-2 px-2 pt-2 sm:px-0 sm:pt-0">
        {leadingAction}
        {resumableBattle ? (
          <RejoinBattleButton
            compact={isMobile}
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
          </RejoinBattleButton>
        ) : (
          // Greyed out but clickable before the start, with a warning (decision 3).
          <StartBattleButton
            campaignId={campaignId}
            creatorUserId={user?.id ?? 0}
            players={players}
            campaignStarted={campaignStarted}
            disabled={isBattlesLoading}
            className={battleButtonClass(isMobile)}
            onBattleCreated={() => {
              void refreshOpenBattles();
              // A reported result waits on the card, with Withdraw for you (BUG-46).
              void invalidatePendingResults(queryClient, campaignId);
            }}
          />
        )}
      </div>

      {resumableBattle && deadlineLabel(resumableBattle.battle) ? (
        <p className="pt-1 text-center text-[0.62rem] uppercase tracking-[0.2em] text-amber-300">
          {deadlineLabel(resumableBattle.battle)}
        </p>
      ) : null}
      {battleError ? <p className="text-center text-sm text-red-600">{battleError}</p> : null}
      <UnfinishedBattleBanner campaignId={campaignId} className="mx-2 mt-2 text-center sm:mx-0" />

      <PendingResultsCard campaignId={campaignId} />

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
          canDeclineInvite={Boolean(canDeclineInvite)}
          onDeclineInvite={() => setIsDeclineConfirmOpen(true)}
        />
      ) : null}

      <ConfirmDialog
        open={isDeclineConfirmOpen}
        onOpenChange={setIsDeclineConfirmOpen}
        title="Decline battle"
        description={
          <div className="space-y-2">
            <p>{DECLINE_INVITE_QUESTION}</p>
            {declining.error ? <p className="text-sm text-red-600">{declining.error}</p> : null}
          </div>
        }
        confirmText={declining.isDeclining ? "Declining..." : "Decline"}
        isConfirming={declining.isDeclining}
        onConfirm={() => void declining.decline()}
      />

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
