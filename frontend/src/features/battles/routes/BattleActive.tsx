import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import { LoadingScreen } from "@/components/ui/loading-screen";
import ActiveBattleHelpers from "@/features/battles/components/active/ActiveBattleHelpers";
import ActiveCancelBattleDialog from "@/features/battles/components/active/ActiveCancelBattleDialog";
import ActiveFinishMineDialog from "@/features/battles/components/active/ActiveFinishMineDialog";
import ActiveHelperDialogs from "@/features/battles/components/active/ActiveHelperDialogs";
import ActiveLeaveDialog from "@/features/battles/components/active/ActiveLeaveDialog";
import ActiveOwnTools from "@/features/battles/components/active/ActiveOwnTools";
import ActiveParticipantRoster from "@/features/battles/components/active/ActiveParticipantRoster";
import ActiveSubnavActions from "@/features/battles/components/active/ActiveSubnavActions";
import { toUnitInformationMap } from "@/features/battles/components/active/active-utils";
import { useActiveMobileBars } from "@/features/battles/components/active/useActiveMobileBars";
import type { BattleLayoutContext } from "@/features/battles/components/layout/battle-shell-types";
import { normalizeCustomUnits } from "@/features/battles/components/prebattle/prebattle-utils";
import BattleDesktopSubnav from "@/features/battles/components/shared/BattleDesktopSubnav";
import BattleFloatingActionBar from "@/features/battles/components/shared/BattleFloatingActionBar";
import BattleNotesDialog from "@/features/battles/components/shared/BattleNotesDialog";
import BattleStatusStrip from "@/features/battles/components/shared/BattleStatusStrip";
import { useActivePage } from "@/features/battles/hooks/useActivePage";
import { allRostersSettled, isRosterLoading } from "@/features/battles/utils/battle-rosters";
import WarbandPdfViewerDialog from "@/features/warbands/components/warband/WarbandPdfViewerDialog";
import { useMediaQuery } from "@/lib/use-media-query";

export default function BattleActive() {
  const { setBattleMobileTopBar, setBattleMobileBottomBar } =
    useOutletContext<BattleLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const page = useActivePage();
  const { battle, selection, config, items, finishing, creatorCancel, helper } = page;
  const { campaignId, battleId, battleState, rosters, rosterLoading, rosterErrors } = battle;
  const { participants } = battleState;
  const { scenario, scenario_link: scenarioLink } = battleState.battle;
  const { currentParticipant, selectedParticipant } = selection;
  const isOwnSelected = selection.selectedParticipantIsCurrentUser;
  const selectedCustomUnits = useMemo(
    () => normalizeCustomUnits(selectedParticipant?.custom_units_json),
    [selectedParticipant?.custom_units_json]
  );
  const selectedUnitInformation = useMemo(
    () => toUnitInformationMap(selectedParticipant?.unit_information_json),
    [selectedParticipant?.unit_information_json]
  );
  const { sectionIdByKey, overflowActions, finishMineAction, openNotes, openScenario } =
    useActiveMobileBars({
      page,
      isMobile,
      selectedCustomUnits,
      setBattleMobileTopBar,
      setBattleMobileBottomBar,
    });

  if (
    participants.length > 0 &&
    (!allRostersSettled(participants, rosters, rosterLoading, rosterErrors) || !selectedParticipant)
  ) {
    return <LoadingScreen message="Loading battle..." />;
  }

  const helpers = {
    rangedDisabled: page.rangedOptions.length === 0,
    meleeDisabled: page.meleeOptions.yours.length === 0 || page.meleeOptions.others.length === 0,
    showScenarioAction: Boolean(scenarioLink),
    onOpenHelper: helper.setOpen,
    onOpenScenario: openScenario,
  };
  const selectedUserId = selectedParticipant?.user.id;
  const canInteract = Boolean(
    selectedParticipant &&
      selectedUserId === page.user?.id &&
      selectedParticipant.status === "in_battle"
  );

  return (
    <div className="battle-page battle-active-page min-h-0 space-y-4 px-2 pb-24 sm:px-0">
      {!isMobile ? (
        <BattleDesktopSubnav
          title="Battle"
          subtitle={`Session #${battleId}${scenario ? ` - ${scenario}` : ""}`}
          participants={selection.statusParticipants}
          selectedParticipantUserId={selection.selectedParticipantUserId}
          onSelectParticipant={selection.setSelectedParticipantUserId}
          actions={
            <ActiveSubnavActions
              onOpenNotes={isOwnSelected ? openNotes : undefined}
              helpers={helpers}
              overflowActions={overflowActions}
            />
          }
        />
      ) : null}
      <BattleStatusStrip />

      {isMobile && selectedParticipant ? (
        <div className="flex flex-wrap items-center justify-center gap-2 px-2">
          <ActiveBattleHelpers
            showLabel={false}
            rangedDisabled={helpers.rangedDisabled}
            meleeDisabled={helpers.meleeDisabled}
            showScenarioAction={helpers.showScenarioAction}
            onOpenRanged={() => helper.setOpen("ranged")}
            onOpenMelee={() => helper.setOpen("melee")}
            onOpenCriticalHits={() => helper.setOpen("critical")}
            onOpenScenario={openScenario}
          />
        </div>
      ) : null}

      {isRosterLoading(selectedParticipant, rosters, rosterLoading) ? (
        <CardBackground className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Loading units...</p>
        </CardBackground>
      ) : selectedParticipant && selectedUserId ? (
        <ActiveParticipantRoster
          participant={selectedParticipant}
          participantRoster={rosters[selectedUserId]}
          rosterLoading={Boolean(rosterLoading[selectedUserId])}
          rosterError={rosterErrors[selectedUserId]}
          unitInformationByKey={selectedUnitInformation}
          killTargetOptions={page.killTargetOptions}
          canInteract={canInteract}
          onSetOutOfAction={page.setOutOfAction}
          onAdjustWounds={config.adjustUnitWounds}
          onSaveOverride={config.saveUnitOverride}
          onSaveUnitNotes={config.saveUnitNotes}
          onRecordKill={page.recordKill}
          onUseSingleUseItem={items.logItemUse}
          getUsedSingleUseItemCount={page.getUsedSingleUseItemCount}
          onUndoSingleUseItem={items.undoItemUse}
          activeItemActionKey={items.activeItemActionKey}
          savingUnitKeys={config.savingUnitKeys}
          sectionIds={sectionIdByKey}
        />
      ) : (
        <CardBackground className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">No warbands available yet.</p>
        </CardBackground>
      )}

      {isOwnSelected && canInteract ? (
        <ActiveOwnTools
          campaignId={campaignId}
          isSaving={config.isSavingConfig}
          error={config.actionError}
          customUnitDraft={config.customUnitDraft}
          onAddCustomUnit={() => void config.addCustomUnit()}
        />
      ) : null}
      {currentParticipant ? (
        <BattleNotesDialog
          open={page.notesDialog.isOpen}
          notes={currentParticipant.battle_notes ?? ""}
          onOpenChange={page.notesDialog.setIsOpen}
          onSave={config.saveBattleNotes}
        />
      ) : null}

      {!isMobile && page.canFinishMine ? (
        <BattleFloatingActionBar>
          <Button
            variant={finishMineAction.variant}
            onClick={finishMineAction.onClick}
            disabled={finishMineAction.disabled}
          >
            {finishMineAction.label}
          </Button>
        </BattleFloatingActionBar>
      ) : null}

      <ActiveLeaveDialog
        open={page.leave.isOpen}
        onOpenChange={page.leave.setIsOpen}
        onConfirm={page.leave.confirm}
      />
      {scenarioLink ? (
        <WarbandPdfViewerDialog
          open={page.scenarioDialog.isOpen}
          onOpenChange={page.scenarioDialog.setIsOpen}
          url={scenarioLink}
          title={scenario || "Scenario"}
        />
      ) : null}
      <ActiveFinishMineDialog finishing={finishing} />
      <ActiveCancelBattleDialog
        open={creatorCancel.isOpen}
        onOpenChange={creatorCancel.setIsOpen}
        isCanceling={creatorCancel.isCanceling}
        error={creatorCancel.error}
        onConfirm={() => void creatorCancel.cancel()}
      />
      <ActiveHelperDialogs
        open={helper.open}
        onOpenChange={helper.setOpen}
        meleeOptions={page.meleeOptions}
        rangedOptions={page.rangedOptions}
      />
    </div>
  );
}
