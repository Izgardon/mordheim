import { useCallback, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading-screen";
import type { BattleLayoutContext } from "@/features/battles/components/layout/battle-shell-types";
import ExplorationSection from "@/features/battles/components/postbattle/ExplorationSection";
import FinalizeSummaryDialog from "@/features/battles/components/postbattle/FinalizeSummaryDialog";
import FindsSection from "@/features/battles/components/postbattle/FindsSection";
import PostbattleSkipDialog from "@/features/battles/components/postbattle/PostbattleSkipDialog";
import RosterResultsSection from "@/features/battles/components/postbattle/RosterResultsSection";
import SeriousInjuryRollDialog from "@/features/battles/components/postbattle/SeriousInjuryRollDialog";
import StatChangesSection from "@/features/battles/components/postbattle/StatChangesSection";
import UpkeepSection from "@/features/battles/components/postbattle/UpkeepSection";
import { usePostbattleMobileBars } from "@/features/battles/components/postbattle/usePostbattleMobileBars";
import BattleDesktopSubnav from "@/features/battles/components/shared/BattleDesktopSubnav";
import BattleFloatingActionBar from "@/features/battles/components/shared/BattleFloatingActionBar";
import BattleNotesDialog from "@/features/battles/components/shared/BattleNotesDialog";
import BattleOverflowMenu from "@/features/battles/components/shared/BattleOverflowMenu";
import BattleStatusStrip from "@/features/battles/components/shared/BattleStatusStrip";
import ClosePostbattleDialog from "@/features/battles/components/shared/ClosePostbattleDialog";
import { usePostbattlePage } from "@/features/battles/hooks/usePostbattlePage";
import { useSectionScrollSpy } from "@/features/battles/hooks/useSectionScrollSpy";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useMediaQuery } from "@/lib/use-media-query";
import { useAppStore } from "@/stores/app-store";

export default function BattlePostbattle() {
  const { campaign, setBattleMobileTopBar, setBattleMobileBottomBar } =
    useOutletContext<BattleLayoutContext>();
  const { user } = useAuth();
  const { diceColor } = useAppStore();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const page = usePostbattlePage(campaign);
  const { battle, currentParticipant, drafting, explore, actions, finds, exit, summary } = page;
  const { battleId, battleState } = battle;
  const { draft, draftError, isSavingDraft } = drafting;
  const [isBattleNotesOpen, setIsBattleNotesOpen] = useState(false);
  const openNotes = useCallback(() => setIsBattleNotesOpen(true), []);
  const openFinalise = exit.finalizeDialog.setIsOpen;
  const finaliseBlocked =
    exit.isFinalized || exit.isFinalizing || exit.isSkipping || isSavingDraft || !page.canFinalize;
  const finaliseState = exit.isFinalizing ? "Finalising..." : exit.isFinalized ? "Finalised" : null;

  const sections = useSectionScrollSpy({
    isMobile,
    hasUpkeep: page.upkeepRows.length > 0,
    hasStatChanges: page.statChangeRows.length > 0,
  });
  usePostbattleMobileBars({
    isMobile,
    currentParticipant,
    setBattleMobileTopBar,
    setBattleMobileBottomBar,
    onBack: exit.back,
    onOpenNotes: openNotes,
    overflowActions: exit.overflowActions,
    sectionOptions: sections.sectionOptions,
    selectedSection: sections.selectedSection,
    onSectionChange: sections.changeSection,
    finalise: {
      label: finaliseState ?? "Finalise",
      disabled: finaliseBlocked,
      onOpen: useCallback(() => openFinalise(true), [openFinalise]),
    },
  });

  if (!currentParticipant)
    return <p className="text-sm text-red-600">You are not part of this battle.</p>;
  if (
    !page.rosterError &&
    (page.rosterLoading ||
      page.isResourcesLoading ||
      !page.currentRoster ||
      !draft ||
      !explore.exploration)
  ) {
    return <LoadingScreen message="Loading postbattle..." />;
  }

  const { scenario } = battleState.battle;
  return (
    <div className="battle-page battle-postbattle-page min-h-0 space-y-4 px-2 pb-24 sm:px-0">
      {!isMobile ? (
        <BattleDesktopSubnav
          title={`${campaign?.name ?? "Campaign"} - Postbattle`}
          subtitle={`Session #${battleId}${scenario ? ` - ${scenario}` : ""}`}
          participants={[currentParticipant]}
          selectedParticipantUserId={currentParticipant.user.id}
          onSelectParticipant={() => undefined}
          actions={
            <>
              <Button type="button" variant="secondary" size="sm" onClick={openNotes}>
                Battle Notes
              </Button>
              <BattleOverflowMenu actions={exit.overflowActions} appearance="button" />
            </>
          }
        />
      ) : null}
      <BattleStatusStrip />

      <ExplorationSection
        isMobile={isMobile}
        explore={explore}
        resources={page.resources}
        isFinalized={exit.isFinalized}
        isSavingDraft={isSavingDraft}
        draftError={draftError}
        diceColor={diceColor}
      />
      <RosterResultsSection
        isMobile={isMobile}
        groups={page.groups}
        rosterLoading={page.rosterLoading}
        rosterError={page.rosterError}
        tools={page.rowTools}
      />
      <StatChangesSection
        isMobile={isMobile}
        rows={page.statChangeRows}
        isFinalized={exit.isFinalized}
        onToggleKeep={actions.toggleKeepStats}
      />
      <FindsSection
        isMobile={isMobile}
        draft={draft}
        finds={finds}
        isFinalized={exit.isFinalized}
      />
      {page.upkeepRows.length > 0 ? (
        <UpkeepSection
          isMobile={isMobile}
          rows={page.upkeepRows}
          total={page.upkeepTotal}
          payUpkeep={Boolean(draft?.upkeep.pay_upkeep)}
          isFinalized={exit.isFinalized}
          onCommitCost={actions.commitUpkeepCost}
          onTogglePayUpkeep={actions.togglePayUpkeep}
        />
      ) : null}

      {!isMobile ? (
        <BattleFloatingActionBar>
          <Button type="button" disabled={finaliseBlocked} onClick={() => openFinalise(true)}>
            {finaliseState ?? "Finalise Postbattle"}
          </Button>
        </BattleFloatingActionBar>
      ) : null}

      <SeriousInjuryRollDialog
        target={actions.rollTarget}
        heroRollType={page.heroDeathRoll}
        themeColor={diceColor}
        open={Boolean(actions.rollTarget)}
        disabled={exit.isFinalized || isSavingDraft || actions.isInjuryRolling}
        onOpenChange={(open) => !open && actions.setRollTarget(null)}
        onRollComplete={(results) => void actions.rollSeriousInjury(results)}
        onRollingChange={actions.setIsInjuryRolling}
      />
      <FinalizeSummaryDialog
        open={exit.finalizeDialog.isOpen}
        onOpenChange={openFinalise}
        warbandName={currentParticipant.warband.name}
        summary={summary}
        showUpkeep={page.upkeepRows.length > 0}
        error={draftError}
        confirmDisabled={finaliseBlocked}
        isFinalizing={exit.isFinalizing}
        onConfirm={() => void exit.finalize()}
      />
      <ClosePostbattleDialog
        open={exit.closing.isOpen}
        onOpenChange={exit.closing.openChange}
        participants={battleState.participants}
        currentUserId={user?.id}
        hasWinners={(battleState.battle.winner_warband_ids_json ?? []).length > 0}
        isClosing={exit.closing.isClosing}
        error={exit.closing.error}
        onConfirm={() => void exit.closing.close()}
      />
      <PostbattleSkipDialog
        open={exit.skipDialog.isOpen}
        onOpenChange={exit.skipDialog.setIsOpen}
        warbandName={currentParticipant.warband.name}
        summary={summary}
        isSkipping={exit.isSkipping}
        error={draftError}
        onConfirm={() => void exit.skip()}
      />
      <BattleNotesDialog
        open={isBattleNotesOpen}
        notes={currentParticipant.battle_notes ?? ""}
        onOpenChange={setIsBattleNotesOpen}
        onSave={page.saveBattleNotes}
      />
    </div>
  );
}
