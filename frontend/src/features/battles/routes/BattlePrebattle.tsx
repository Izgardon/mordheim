import { useCallback, useMemo } from "react";
import { useOutletContext } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading-screen";
import type { BattleLayoutContext } from "@/features/battles/components/layout/battle-shell-types";
import PrebattleActionBar from "@/features/battles/components/prebattle/PrebattleActionBar";
import PrebattleDialogs from "@/features/battles/components/prebattle/PrebattleDialogs";
import PrebattleInviteGate from "@/features/battles/components/prebattle/PrebattleInviteGate";
import PrebattleRosterPanel from "@/features/battles/components/prebattle/PrebattleRosterPanel";
import {
  usePrebattleMobileBottomBar,
  usePrebattleMobileTopBar,
} from "@/features/battles/components/prebattle/usePrebattleMobileBars";
import BattleDesktopSubnav from "@/features/battles/components/shared/BattleDesktopSubnav";
import BattleNotesDialog from "@/features/battles/components/shared/BattleNotesDialog";
import BattleStatusStrip from "@/features/battles/components/shared/BattleStatusStrip";
import BattleTopBarActions from "@/features/battles/components/shared/BattleTopBarActions";
import { usePrebattlePage } from "@/features/battles/hooks/usePrebattlePage";
import { allRostersSettled, isRosterLoading } from "@/features/battles/utils/battle-rosters";
import WarbandPdfViewerDialog from "@/features/warbands/components/warband/WarbandPdfViewerDialog";
import { useMediaQuery } from "@/lib/use-media-query";

export default function BattlePrebattle() {
  const { campaign, setBattleMobileTopBar, setBattleMobileBottomBar } =
    useOutletContext<BattleLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const page = usePrebattlePage();
  const { battle, selection, isOwnSelected, config, ratings, ready, flags } = page;
  const { start, creatorCancel, declining, items } = page;
  const { campaignId, battleId, battleState, rosters, rosterLoading, rosterErrors } = battle;
  const { participants } = battleState;
  const { scenario, scenario_link: scenarioLink } = battleState.battle;
  const { currentParticipant, selectedParticipant } = selection;
  const setNotesOpen = page.notesDialog.setIsOpen;
  const setScenarioOpen = page.scenarioDialog.setIsOpen;

  const openNotes = useCallback(() => setNotesOpen(true), [setNotesOpen]);
  const openScenario = useCallback(() => setScenarioOpen(true), [setScenarioOpen]);
  const mobileTopBarExtraActions = useMemo(
    () =>
      isOwnSelected || scenarioLink ? (
        <BattleTopBarActions
          onOpenNotes={isOwnSelected ? openNotes : undefined}
          onOpenScenario={scenarioLink ? openScenario : undefined}
        />
      ) : null,
    [isOwnSelected, openNotes, openScenario, scenarioLink]
  );

  const { sectionIdByKey } = usePrebattleMobileTopBar({
    isMobile,
    setBattleMobileTopBar,
    title: "In Prebattle",
    onBack: () => page.leave.setIsOpen(true),
    extraActions: mobileTopBarExtraActions,
    statusParticipants: selection.statusParticipants,
    selectedParticipant,
    selectedParticipantRoster: selectedParticipant
      ? rosters[selectedParticipant.user.id]
      : undefined,
    selectedParticipantCustomUnits: page.visible.customUnits,
    onSelectParticipantUserId: selection.setSelectedParticipantUserId,
  });
  usePrebattleMobileBottomBar({
    isMobile,
    setBattleMobileBottomBar,
    isUpdatingReady: ready.isUpdatingReady,
    currentUserReady: flags.currentUserReady,
    readyDisabled: flags.readyDisabled,
    onToggleReady: ready.toggleReady,
    showStart: flags.showStart,
    isStartingBattle: start.isStarting,
    startDisabled: flags.startDisabled,
    canCreatorCancelBattle: flags.canCreatorCancelBattle,
    isCancelingBattle: creatorCancel.isCanceling,
    onOpenStart: () => start.setIsOpen(true),
    onOpenCancel: () => creatorCancel.setIsOpen(true),
  });

  if (
    !flags.invitePending &&
    participants.length > 0 &&
    !allRostersSettled(participants, rosters, rosterLoading, rosterErrors)
  ) {
    return <LoadingScreen message="Loading prebattle..." />;
  }

  const selectedUserId = selectedParticipant?.user.id;
  const statusRating = selectedUserId ? ratings.statusRatingByUserId[selectedUserId] : null;
  const declaredRating = selectedParticipant?.declared_rating;
  return (
    <div className="battle-page battle-prebattle-page min-h-0 space-y-4 px-2 pb-24 sm:px-0">
      {!isMobile ? (
        <BattleDesktopSubnav
          title={`${campaign?.name ?? "Campaign"} - Prebattle`}
          subtitle={[`Session #${battleId}`, ...(scenario ? [scenario] : [])].join(" • ")}
          participants={selection.statusParticipants}
          selectedParticipantUserId={selection.selectedParticipantUserId}
          onSelectParticipant={selection.setSelectedParticipantUserId}
          actions={
            isOwnSelected ? (
              <Button type="button" variant="secondary" size="sm" onClick={openNotes}>
                Battle Notes
              </Button>
            ) : undefined
          }
        />
      ) : null}
      <BattleStatusStrip />

      {ready.isSavingConfig ? (
        <p className="text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground">
          Saving unit config...
        </p>
      ) : null}
      {ready.actionError ? <p className="text-sm text-red-600">{ready.actionError}</p> : null}

      {flags.invitePending ? (
        <PrebattleInviteGate
          canAcceptInvite={flags.canAcceptInvite}
          isAcceptingInvite={ready.isAcceptingInvite}
          waitingForOthers={flags.waitingForOthers}
          canCreatorCancelBattle={flags.canCreatorCancelBattle}
          isCancelingBattle={creatorCancel.isCanceling}
          onAcceptInvite={ready.acceptInvite}
          onOpenCancelBattle={() => creatorCancel.setIsOpen(true)}
          canDeclineInvite={flags.canDeclineInvite}
          isDecliningInvite={declining.isDeclining}
          declineError={declining.error}
          onDeclineInvite={() => void declining.decline()}
        />
      ) : (
        <PrebattleRosterPanel
          campaignId={campaignId}
          participant={selectedParticipant}
          isOwn={isOwnSelected}
          editable={flags.canEditOwnConfig}
          isRosterLoading={isRosterLoading(selectedParticipant, rosters, rosterLoading)}
          roster={selectedUserId ? rosters[selectedUserId] : undefined}
          rosterLoading={Boolean(selectedUserId && rosterLoading[selectedUserId])}
          rosterError={selectedUserId ? rosterErrors[selectedUserId] : undefined}
          visible={page.visible}
          ratingInputValue={
            flags.canEditOwnConfig && selectedUserId
              ? (ratings.ratingInputsByUserId[selectedUserId] ??
                (declaredRating === null ? "" : String(declaredRating)))
              : statusRating === null || statusRating === undefined
                ? ""
                : String(statusRating)
          }
          onRatingInputChange={(value) =>
            selectedUserId ? ratings.setRatingInput(selectedUserId, value) : undefined
          }
          config={config}
          onAddCustomUnit={() => {
            if (config.addCustomUnit()) {
              ready.setActionError("");
            }
          }}
          getUsedSingleUseItemCount={page.getUsedSingleUseItemCount}
          activeItemActionKey={items.activeItemActionKey}
          onUseSingleUseItem={items.logItemUse}
          sectionIds={sectionIdByKey}
        />
      )}

      {!isMobile ? (
        <PrebattleActionBar
          isSavingConfig={ready.isSavingConfig}
          actionError={ready.actionError}
          invitePending={flags.invitePending}
          battleStatus={battleState.battle.status}
          hasCurrentParticipant={Boolean(currentParticipant)}
          currentParticipantStatus={currentParticipant?.status}
          currentUserReady={flags.currentUserReady}
          isUpdatingReady={ready.isUpdatingReady}
          isCancelingBattle={creatorCancel.isCanceling}
          showStart={flags.showStart}
          startDisabled={flags.startDisabled}
          canCreatorCancelBattle={flags.canCreatorCancelBattle}
          onToggleReady={ready.toggleReady}
          onOpenCreatorCancel={() => creatorCancel.setIsOpen(true)}
          onOpenStartDialog={() => start.setIsOpen(true)}
        />
      ) : null}

      <PrebattleDialogs
        isLeaveDialogOpen={page.leave.isOpen}
        onLeaveDialogChange={page.leave.setIsOpen}
        onConfirmLeave={page.leave.confirm}
        isStartDialogOpen={start.isOpen}
        onStartDialogChange={start.openChange}
        startQuestion={flags.startQuestion}
        startError={start.error}
        isStartingBattle={start.isStarting}
        onConfirmStart={start.start}
        isCancelBattleDialogOpen={creatorCancel.isOpen}
        onCancelBattleDialogChange={(open) => {
          creatorCancel.setIsOpen(open);
          if (!open) {
            creatorCancel.setError("");
          }
        }}
        cancelBattleError={creatorCancel.error}
        isCancelingBattle={creatorCancel.isCanceling}
        onConfirmCancelBattle={creatorCancel.cancel}
      />
      {currentParticipant ? (
        <BattleNotesDialog
          open={page.notesDialog.isOpen}
          notes={currentParticipant.battle_notes ?? ""}
          onOpenChange={setNotesOpen}
          onSave={ready.saveBattleNotes}
        />
      ) : null}
      {scenarioLink ? (
        <WarbandPdfViewerDialog
          open={page.scenarioDialog.isOpen}
          onOpenChange={setScenarioOpen}
          url={scenarioLink}
          title={scenario || "Scenario"}
        />
      ) : null}
    </div>
  );
}
