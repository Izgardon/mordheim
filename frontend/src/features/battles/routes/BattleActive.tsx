import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useOutletContext, useParams } from "react-router-dom";

import { CardBackground } from "@/components/ui/card-background";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import {
  cancelBattleAsCreator,
  finishBattle,
  getBattleState,
  recordUnitKill,
  setUnitOutOfAction,
} from "@/features/battles/api/battles-api";
import ActiveParticipantRoster from "@/features/battles/components/active/ActiveParticipantRoster";
import {
  buildBattleUnitOptions,
  toUnitInformationMap,
} from "@/features/battles/components/active/active-utils";
import {
  useBattleMobileBottomBar,
  useBattleMobileTopBar,
} from "@/features/battles/components/shared/useBattleMobileBars";
import { usePrebattleRosters } from "@/features/battles/components/prebattle/usePrebattleRosters";
import {
  normalizeCustomUnits,
  toUnitRating,
} from "@/features/battles/components/prebattle/prebattle-utils";
import type { BattleState } from "@/features/battles/types/battle-types";
import type { BattleLayoutContext } from "@/features/battles/routes/BattleLayout";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { createBattleSessionSocket } from "@/lib/realtime";
import { useMediaQuery } from "@/lib/use-media-query";

export default function BattleActive() {
  const { id, battleId } = useParams();
  const { setBattleMobileTopBar, setBattleMobileBottomBar } = useOutletContext<BattleLayoutContext>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 960px)");

  const campaignId = Number(id);
  const numericBattleId = Number(battleId);

  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const { rosters, rosterLoading, rosterErrors } = usePrebattleRosters(
    battleState?.participants
  );
  const [selectedParticipantUserId, setSelectedParticipantUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false);
  const [isFinishingBattle, setIsFinishingBattle] = useState(false);
  const [finishError, setFinishError] = useState("");

  const [isCancelBattleDialogOpen, setIsCancelBattleDialogOpen] = useState(false);
  const [isCancelingBattle, setIsCancelingBattle] = useState(false);
  const [cancelBattleError, setCancelBattleError] = useState("");

  const refreshBattleState = useCallback(async () => {
    if (Number.isNaN(campaignId) || Number.isNaN(numericBattleId)) {
      return;
    }
    const state = await getBattleState(campaignId, numericBattleId, 0);
    setBattleState(state);
  }, [campaignId, numericBattleId]);

  useEffect(() => {
    if (Number.isNaN(campaignId) || Number.isNaN(numericBattleId)) {
      setError("Invalid battle route.");
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError("");

    getBattleState(campaignId, numericBattleId, 0)
      .then((state) => {
        if (active) {
          setBattleState(state);
        }
      })
      .catch((errorResponse) => {
        if (!active) {
          return;
        }
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load battle");
        } else {
          setError("Unable to load battle");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [campaignId, numericBattleId]);

  useEffect(() => {
    if (Number.isNaN(numericBattleId)) {
      return;
    }
    const socket = createBattleSessionSocket(numericBattleId, () => {
      void refreshBattleState();
    });
    return () => {
      socket.close();
    };
  }, [numericBattleId, refreshBattleState]);

  const currentParticipant = useMemo(
    () => battleState?.participants.find((participant) => participant.user.id === user?.id) ?? null,
    [battleState?.participants, user?.id]
  );

  useEffect(() => {
    const participants = battleState?.participants ?? [];
    if (participants.length === 0) {
      setSelectedParticipantUserId(null);
      return;
    }
    if (
      selectedParticipantUserId !== null &&
      participants.some((participant) => participant.user.id === selectedParticipantUserId)
    ) {
      return;
    }
    setSelectedParticipantUserId(currentParticipant?.user.id ?? participants[0].user.id);
  }, [battleState?.participants, currentParticipant, selectedParticipantUserId]);

  const selectedParticipant = useMemo(() => {
    const participants = battleState?.participants ?? [];
    if (participants.length === 0) {
      return null;
    }
    const bySelection = participants.find(
      (participant) => participant.user.id === selectedParticipantUserId
    );
    if (bySelection) {
      return bySelection;
    }
    if (currentParticipant) {
      return currentParticipant;
    }
    return participants[0];
  }, [battleState?.participants, currentParticipant, selectedParticipantUserId]);

  const selectedParticipantCustomUnits = useMemo(
    () => normalizeCustomUnits(selectedParticipant?.custom_units_json),
    [selectedParticipant?.custom_units_json]
  );
  const selectedParticipantUnitInformation = useMemo(
    () => toUnitInformationMap(selectedParticipant?.unit_information_json),
    [selectedParticipant?.unit_information_json]
  );
  const killTargetOptions = useMemo(
    () => buildBattleUnitOptions(battleState?.participants ?? [], rosters),
    [battleState?.participants, rosters]
  );

  const statusParticipants = useMemo(() => {
    const participants = battleState?.participants ?? [];
    const currentUserId = user?.id;
    if (!currentUserId) {
      return participants;
    }
    const mine = participants.find((participant) => participant.user.id === currentUserId);
    if (!mine) {
      return participants;
    }
    return [mine, ...participants.filter((participant) => participant.user.id !== currentUserId)];
  }, [battleState?.participants, user?.id]);

  const { sectionIdByKey } = useBattleMobileTopBar({
    isMobile,
    setBattleMobileTopBar,
    statusParticipants,
    selectedParticipant,
    selectedParticipantRoster: selectedParticipant
      ? rosters[selectedParticipant.user.id]
      : undefined,
    selectedParticipantCustomUnits,
    onSelectParticipantUserId: setSelectedParticipantUserId,
  });

  const isBattleCreator = useMemo(
    () => battleState?.battle.created_by_user_id === user?.id,
    [battleState?.battle.created_by_user_id, user?.id]
  );

  const activeBottomBarConfig = useMemo(
    () =>
      battleState?.battle.status === "active"
        ? {
            leftAction: {
              label: "Leave",
              onClick: () => setIsLeaveDialogOpen(true),
              variant: "secondary" as const,
            },
            primaryAction: {
              label: isFinishingBattle ? "Finishing..." : "Finish Battle",
              onClick: () => setIsFinishDialogOpen(true),
              disabled: isFinishingBattle,
              variant: "secondary" as const,
            },
            secondaryAction: isBattleCreator
              ? {
                  label: isCancelingBattle ? "Canceling..." : "Cancel battle",
                  onClick: () => setIsCancelBattleDialogOpen(true),
                  disabled: isCancelingBattle,
                  variant: "destructive" as const,
                }
              : undefined,
          }
        : null,
    [battleState?.battle.status, isBattleCreator, isCancelingBattle, isFinishingBattle]
  );

  useBattleMobileBottomBar({
    isMobile,
    setBattleMobileBottomBar,
    config: activeBottomBarConfig,
  });

  const handleLeaveBattle = useCallback(() => {
    setIsLeaveDialogOpen(false);
    navigate(`/campaigns/${campaignId}`);
  }, [campaignId, navigate]);

  const handleFinishBattle = useCallback(async () => {
    setIsFinishingBattle(true);
    setFinishError("");
    try {
      const next = await finishBattle(campaignId, numericBattleId);
      setBattleState(next);
      setIsFinishDialogOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFinishError(errorResponse.message || "Unable to finish battle");
      } else {
        setFinishError("Unable to finish battle");
      }
    } finally {
      setIsFinishingBattle(false);
    }
  }, [campaignId, numericBattleId]);

  const handleCancelBattle = useCallback(async () => {
    setIsCancelingBattle(true);
    setCancelBattleError("");
    try {
      const next = await cancelBattleAsCreator(campaignId, numericBattleId);
      setBattleState(next);
      setIsCancelBattleDialogOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setCancelBattleError(errorResponse.message || "Unable to cancel battle");
      } else {
        setCancelBattleError("Unable to cancel battle");
      }
    } finally {
      setIsCancelingBattle(false);
    }
  }, [campaignId, numericBattleId]);

  const handleSetUnitOutOfAction = useCallback(
    async (unitKey: string, outOfAction: boolean) => {
      const next = await setUnitOutOfAction(campaignId, numericBattleId, {
        unit_key: unitKey,
        out_of_action: outOfAction,
      });
      setBattleState(next);
    },
    [campaignId, numericBattleId]
  );

  const handleRecordUnitKill = useCallback(
    async (payload: {
      killerUnitKey: string;
      victimUnitKey?: string;
      victimName?: string;
      earnedXp: boolean;
    }) => {
      const next = await recordUnitKill(campaignId, numericBattleId, {
        killer_unit_key: payload.killerUnitKey,
        victim_unit_key: payload.victimUnitKey,
        victim_name: payload.victimName,
        earned_xp: payload.earnedXp,
      });
      setBattleState(next);
    },
    [campaignId, numericBattleId]
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading battle...</p>;
  }

  if (error || !battleState) {
    return <p className="text-sm text-red-600">{error || "Unable to load battle."}</p>;
  }

  if (battleState.battle.status === "canceled" || battleState.battle.status === "ended") {
    return <Navigate to={`/campaigns/${campaignId}`} replace />;
  }

  if (battleState.battle.status === "prebattle") {
    return <Navigate to={`/campaigns/${campaignId}/battles/${numericBattleId}/prebattle`} replace />;
  }

  if (battleState.battle.status === "postbattle") {
    return <Navigate to={`/campaigns/${campaignId}/battles/${numericBattleId}/postbattle`} replace />;
  }

  const selectedParticipantRoster = selectedParticipant
    ? rosters[selectedParticipant.user.id]
    : undefined;
  const isSelectedRosterLoading = Boolean(
    selectedParticipant &&
      rosterLoading[selectedParticipant.user.id] &&
      !rosters[selectedParticipant.user.id]
  );
  const selectedParticipantDisplayRating = selectedParticipant
    ? (() => {
        const customTotal = normalizeCustomUnits(selectedParticipant.custom_units_json).reduce(
          (sum, unit) => sum + toUnitRating(unit.rating),
          0
        );
        if (selectedParticipant.declared_rating === null && customTotal === 0) {
          return null;
        }
        return (selectedParticipant.declared_rating ?? 0) + customTotal;
      })()
    : null;
  const canInteractWithSelectedParticipant = Boolean(
    selectedParticipant &&
      selectedParticipant.user.id === user?.id &&
      selectedParticipant.status === "in_battle"
  );

  return (
    <div className="min-h-0 space-y-4 px-2 pb-24 sm:px-0">
      {!isMobile ? (
        <PageHeader
          title="Battle"
          subtitle={`Session #${battleId ?? "-"}${battleState.battle.title ? ` - ${battleState.battle.title}` : ""}`}
        />
      ) : null}

      {isSelectedRosterLoading ? (
        <CardBackground className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Loading units...</p>
        </CardBackground>
      ) : selectedParticipant ? (
        <ActiveParticipantRoster
          participant={selectedParticipant}
          ratingDisplay={
            selectedParticipantDisplayRating === null ? "-" : String(selectedParticipantDisplayRating)
          }
          participantRoster={selectedParticipantRoster}
          rosterLoading={Boolean(rosterLoading[selectedParticipant.user.id])}
          rosterError={rosterErrors[selectedParticipant.user.id]}
          unitInformationByKey={selectedParticipantUnitInformation}
          killTargetOptions={killTargetOptions}
          canInteract={canInteractWithSelectedParticipant}
          onSetOutOfAction={handleSetUnitOutOfAction}
          onRecordKill={handleRecordUnitKill}
          sectionIds={sectionIdByKey}
        />
      ) : (
        <CardBackground className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">No warbands available yet.</p>
        </CardBackground>
      )}

      <ConfirmDialog
        open={isLeaveDialogOpen}
        onOpenChange={setIsLeaveDialogOpen}
        description={
          <div className="space-y-2">
            <p>Leave this battle session?</p>
            <p className="text-xs text-muted-foreground">
              You can return later from the campaign overview while the battle is still ongoing.
            </p>
          </div>
        }
        confirmText="Leave"
        confirmVariant="secondary"
        onConfirm={handleLeaveBattle}
        onCancel={() => setIsLeaveDialogOpen(false)}
      />

      <ConfirmDialog
        open={isFinishDialogOpen}
        onOpenChange={setIsFinishDialogOpen}
        description={
          <div className="space-y-2">
            <p>Finish your battle now?</p>
            {finishError ? <p className="text-sm text-red-600">{finishError}</p> : null}
          </div>
        }
        confirmText={isFinishingBattle ? "Finishing..." : "Finish battle"}
        confirmDisabled={isFinishingBattle}
        isConfirming={isFinishingBattle}
        confirmVariant="default"
        onConfirm={handleFinishBattle}
        onCancel={() => setIsFinishDialogOpen(false)}
      />

      <ConfirmDialog
        open={isCancelBattleDialogOpen}
        onOpenChange={setIsCancelBattleDialogOpen}
        description={
          <div className="space-y-2">
            <p>Cancel this battle for all participants?</p>
            {cancelBattleError ? <p className="text-sm text-red-600">{cancelBattleError}</p> : null}
          </div>
        }
        confirmText={isCancelingBattle ? "Canceling..." : "Cancel battle"}
        confirmDisabled={isCancelingBattle}
        isConfirming={isCancelingBattle}
        confirmVariant="destructive"
        onConfirm={handleCancelBattle}
        onCancel={() => setIsCancelBattleDialogOpen(false)}
      />
    </div>
  );
}
