import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import { Checkbox } from "@/components/ui/checkbox";
import { CommittedNumberInput } from "@/components/ui/committed-number-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { confirmBattlePostbattle, finalizeBattlePostbattle, getBattleState, saveBattlePostbattleDraft } from "@/features/battles/api/battles-api";
import {
  buildLocalExplorationState,
  buildPostbattleDraft,
  buildRenderableGroups,
  getExplorationResourceAmount,
  getSelectedExplorationDiceValues,
  isPostbattleDraftValid,
  rerollLocalExplorationDie,
  rollAllLocalExplorationDice,
  rollD6SeriousInjury,
  rollHeroSeriousInjury,
  setLocalExplorationDiceCount,
  setLocalExplorationDieValue,
  setLocalExplorationDieSelected,
  setLocalExplorationResource,
  toPostbattleExplorationPayload,
  updateGroupXp,
  updateUnitResult,
  type LocalExplorationState,
  type PostbattleRenderableRow,
} from "@/features/battles/components/postbattle/postbattle-utils";
import { usePrebattleRosters } from "@/features/battles/components/prebattle/usePrebattleRosters";
import type { BattlePostbattleState, BattleState } from "@/features/battles/types/battle-types";
import type { BattleLayoutContext } from "@/features/battles/routes/BattleLayout";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { listWarbandResources } from "@/features/warbands/api/warbands-resources";
import type { WarbandResource } from "@/features/warbands/types/warband-types";
import { createBattleSessionSocket } from "@/lib/realtime";
import { useMediaQuery } from "@/lib/use-media-query";

type RollTarget = { unitKey: string; unitName: string; unitKind: "hero" | "hired_sword" | "henchman" } | null;

function SeriousInjuryRollDialog({
  target,
  heroRollType,
  open,
  disabled,
  onOpenChange,
  onRoll,
}: {
  target: RollTarget;
  heroRollType: "d66" | "d100";
  open: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onRoll: () => void;
}) {
  if (!target) return null;
  const isHero = target.unitKind === "hero";
  const heroRollLabel = heroRollType.toUpperCase();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Serious Injury Roll</DialogTitle>
          <DialogDescription>
            {isHero
              ? `Roll a ${heroRollLabel} guide for ${target.unitName}.`
              : `Roll a D6 for ${target.unitName}. A 1-2 suggests death; 3-6 suggests survival.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="justify-start">
          <Button type="button" onClick={onRoll} disabled={disabled}>{isHero ? `Roll ${heroRollLabel}` : "Roll D6"}</Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostbattleSection({
  isMobile,
  children,
}: {
  isMobile: boolean;
  children: React.ReactNode;
}) {
  if (isMobile) {
    return <section className="space-y-4 border-t border-border/60 pt-4 sm:pt-5">{children}</section>;
  }

  return (
    <CardBackground as="section" className="space-y-4 p-4 sm:p-5">
      {children}
    </CardBackground>
  );
}

export default function BattlePostbattle() {
  const { id, battleId } = useParams();
  const navigate = useNavigate();
  const { campaign, setBattleMobileTopBar, setBattleMobileBottomBar } = useOutletContext<BattleLayoutContext>();
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const campaignId = Number(id);
  const numericBattleId = Number(battleId);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [resources, setResources] = useState<WarbandResource[]>([]);
  const [draft, setDraft] = useState<BattlePostbattleState | null>(null);
  const [localExploration, setLocalExploration] = useState<LocalExplorationState | null>(null);
  const [localExplorationKey, setLocalExplorationKey] = useState<string | null>(null);
  const [draftError, setDraftError] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [rollTarget, setRollTarget] = useState<RollTarget>(null);
  const { rosters, rosterLoading, rosterErrors } = usePrebattleRosters(battleState?.participants);

  const refreshBattleState = useCallback(async () => {
    if (Number.isNaN(campaignId) || Number.isNaN(numericBattleId)) return;
    setBattleState(await getBattleState(campaignId, numericBattleId, 0));
  }, [campaignId, numericBattleId]);

  useEffect(() => {
    if (Number.isNaN(campaignId) || Number.isNaN(numericBattleId)) {
      setError("Invalid battle route.");
      setIsLoading(false);
      return;
    }
    let active = true;
    getBattleState(campaignId, numericBattleId, 0)
      .then((state) => active && setBattleState(state))
      .catch((errorResponse) => {
        if (!active) return;
        setError(errorResponse instanceof Error ? errorResponse.message || "Unable to load battle" : "Unable to load battle");
      })
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [campaignId, numericBattleId]);

  useEffect(() => {
    if (Number.isNaN(numericBattleId)) return;
    const socket = createBattleSessionSocket(numericBattleId, () => void refreshBattleState());
    return () => socket.close();
  }, [numericBattleId, refreshBattleState]);

  const currentParticipant = useMemo(
    () => battleState?.participants.find((participant) => participant.user.id === user?.id) ?? null,
    [battleState?.participants, user?.id]
  );
  const currentRoster = currentParticipant ? rosters[currentParticipant.user.id] : undefined;
  const isFinalized = currentParticipant?.status === "confirmed_postbattle";
  const heroDeathRoll = campaign?.hero_death_roll ?? "d66";
  const currentRosterLoading = currentParticipant ? rosterLoading[currentParticipant.user.id] : false;
  const currentRosterError = currentParticipant ? rosterErrors[currentParticipant.user.id] : "";

  useEffect(() => {
    if (!currentParticipant) {
      setResources([]);
      return;
    }
    let active = true;
    listWarbandResources(currentParticipant.warband.id)
      .then((data) => active && setResources(data))
      .catch(() => active && setResources([]));
    return () => {
      active = false;
    };
  }, [currentParticipant?.warband.id]);

  useEffect(() => {
    if (!battleState || !currentParticipant || !currentRoster) return;
    setDraft(buildPostbattleDraft(battleState.battle, currentParticipant, currentRoster, resources, battleState.events));
  }, [battleState?.battle, battleState?.events, currentParticipant?.id, currentParticipant?.postbattle_json, currentParticipant?.unit_information_json, currentParticipant?.selected_unit_keys_json, currentRoster, resources]);

  useEffect(() => {
    if (!battleState || !currentParticipant || !currentRoster) {
      return;
    }
    const ownerKey = `${battleState.battle.id}:${currentParticipant.id}`;
    if (localExplorationKey !== ownerKey) {
      setLocalExploration(
        buildLocalExplorationState(currentParticipant, currentRoster, battleState.battle, resources)
      );
      setLocalExplorationKey(ownerKey);
      return;
    }
    if (localExploration && localExploration.resourceId === null && resources.length > 0) {
      setLocalExploration(setLocalExplorationResource(localExploration, resources[0].id));
    }
  }, [
    battleState?.battle,
    currentParticipant?.id,
    currentParticipant?.unit_information_json,
    currentRoster,
    localExploration,
    localExplorationKey,
    resources,
  ]);

  const persistDraft = useCallback(async (nextDraft: BattlePostbattleState) => {
    setDraft(nextDraft);
    setIsSavingDraft(true);
    setDraftError("");
    try {
      const next = await saveBattlePostbattleDraft(campaignId, numericBattleId, {
        postbattle_json: {
          exploration: {
            dice_values: [],
            resource_id: null,
          },
          unit_results: nextDraft.unit_results,
        },
      });
      setBattleState(next);
    } catch (errorResponse) {
      setDraftError(errorResponse instanceof Error ? errorResponse.message || "Unable to save postbattle draft" : "Unable to save postbattle draft");
    } finally {
      setIsSavingDraft(false);
    }
  }, [campaignId, numericBattleId]);

  const handleToggleDead = useCallback(async (row: PostbattleRenderableRow, checked: boolean) => {
    if (!draft) return;
    await persistDraft(updateUnitResult(draft, row.unitKey, (current) => ({ ...current, dead: checked })));
  }, [draft, persistDraft]);

  const handleRollSeriousInjury = useCallback(async () => {
    if (!draft || !rollTarget) return;
    const roll =
      rollTarget.unitKind === "hero"
        ? rollHeroSeriousInjury(heroDeathRoll)
        : rollD6SeriousInjury();
    setRollTarget(null);
    await persistDraft(
      updateUnitResult(draft, rollTarget.unitKey, (current) => ({
        ...current,
        dead: roll.dead_suggestion ? true : current.dead,
        serious_injury_rolls: [...current.serious_injury_rolls, roll],
      }))
    );
  }, [draft, heroDeathRoll, persistDraft, rollTarget]);

  const handleCommitDiceCount = useCallback((nextCount: number) => {
    if (!localExploration) {
      return;
    }
    setLocalExploration(setLocalExplorationDiceCount(localExploration, nextCount));
  }, [localExploration]);

  const handleCommitUnitXp = useCallback((unitKey: string, nextXp: number) => {
    if (!draft || draft.unit_results[unitKey]?.xp_earned === nextXp) {
      return;
    }
    void persistDraft(
      updateUnitResult(draft, unitKey, (current) => ({
        ...current,
        xp_earned: nextXp,
      }))
    );
  }, [draft, persistDraft]);

  const handleCommitGroupXp = useCallback((groupKey: string, nextXp: number) => {
    if (!draft) {
      return;
    }
    const matchingResult = Object.values(draft.unit_results).find(
      (result) => result.unit_kind === "henchman" && result.group_name === groupKey
    );
    if (matchingResult?.xp_earned === nextXp) {
      return;
    }
    void persistDraft(updateGroupXp(draft, groupKey, nextXp));
  }, [draft, persistDraft]);

  const handleFinalize = useCallback(async () => {
    if (!draft || !currentParticipant || !localExploration) return;
    setIsFinalizing(true);
    setDraftError("");
    try {
      await finalizeBattlePostbattle(campaignId, numericBattleId, {
        postbattle_json: {
          ...draft,
          exploration: toPostbattleExplorationPayload(localExploration),
        },
      });
      setIsFinalizeModalOpen(false);
      navigate(`/campaigns/${campaignId}/warbands/${currentParticipant.warband.id}`, { replace: true });
    } catch (errorResponse) {
      setDraftError(errorResponse instanceof Error ? errorResponse.message || "Unable to finalise postbattle" : "Unable to finalise postbattle");
    } finally {
      setIsFinalizing(false);
    }
  }, [campaignId, currentParticipant, draft, localExploration, navigate, numericBattleId]);

  const handleLeaveWithoutSaving = useCallback(async () => {
    if (!currentParticipant) return;
    setIsLeaving(true);
    setDraftError("");
    try {
      await confirmBattlePostbattle(campaignId, numericBattleId);
      setIsFinalizeModalOpen(false);
      navigate(`/campaigns/${campaignId}/warbands/${currentParticipant.warband.id}`, { replace: true });
    } catch (errorResponse) {
      setDraftError(errorResponse instanceof Error ? errorResponse.message || "Unable to leave postbattle" : "Unable to leave postbattle");
    } finally {
      setIsLeaving(false);
    }
  }, [campaignId, currentParticipant, navigate, numericBattleId]);

  const groups = useMemo(() => (draft ? buildRenderableGroups(draft) : []), [draft]);
  const explorationAmount = useMemo(
    () => getExplorationResourceAmount(localExploration ? getSelectedExplorationDiceValues(localExploration) : []),
    [localExploration]
  );
  const explorationResource = useMemo(
    () => resources.find((resource) => resource.id === localExploration?.resourceId) ?? null,
    [localExploration?.resourceId, resources]
  );
  const finalizeSummary = useMemo(() => {
    const rows = groups.flatMap((group) => group.rows);
    const deaths = rows.filter((row) => row.dead);
    const xpAwards = rows
      .filter((row) => row.xpEarned > 0)
      .map((row) => ({ unitKey: row.unitKey, unitName: row.unitName, xpEarned: row.xpEarned }));
    return {
      deaths,
      xpAwards,
      resourceAmount: explorationAmount,
      resourceName: explorationResource?.name ?? null,
    };
  }, [explorationAmount, explorationResource?.name, groups]);
  const canFinalize = Boolean(draft && localExploration && isPostbattleDraftValid(draft));

  useEffect(() => {
    if (!isMobile || !currentParticipant) {
      setBattleMobileTopBar?.(null);
      setBattleMobileBottomBar?.(null);
      return;
    }

    setBattleMobileTopBar?.({
      title: "Postbattle",
      onBack: () => window.history.back(),
    });

      setBattleMobileBottomBar?.({
      primaryAction: {
        label: isFinalizing ? "Finalising..." : isFinalized ? "Finalised" : "Finalise",
        onClick: () => setIsFinalizeModalOpen(true),
        disabled: isFinalized || isFinalizing || isLeaving || isSavingDraft || !canFinalize,
        variant: "default",
      },
      secondaryAction: {
        label: isLeaving ? "Leaving..." : "Leave",
        onClick: () => void handleLeaveWithoutSaving(),
        disabled: isFinalized || isFinalizing || isLeaving || isSavingDraft,
        variant: "secondary",
      },
    });

    return () => {
      setBattleMobileTopBar?.(null);
      setBattleMobileBottomBar?.(null);
    };
  }, [
    currentParticipant,
    draft,
    handleFinalize,
    handleLeaveWithoutSaving,
    isFinalized,
    isFinalizing,
    isLeaving,
    isMobile,
    isSavingDraft,
    canFinalize,
    setBattleMobileBottomBar,
    setBattleMobileTopBar,
  ]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading postbattle...</p>;
  if (error || !battleState) return <p className="text-sm text-red-600">{error || "Unable to load postbattle."}</p>;
  if (battleState.battle.status === "canceled" || battleState.battle.status === "ended") return <Navigate to={`/campaigns/${campaignId}`} replace />;
  if (battleState.battle.status === "prebattle") return <Navigate to={`/campaigns/${campaignId}/battles/${numericBattleId}/prebattle`} replace />;
  if (battleState.battle.status === "active") return <Navigate to={`/campaigns/${campaignId}/battles/${numericBattleId}/active`} replace />;
  if (!currentParticipant) return <p className="text-sm text-red-600">You are not part of this battle.</p>;

  return (
    <div className="min-h-0 space-y-3 px-2 pb-24 sm:px-0">
      {!isMobile ? (
        <PageHeader
          title="Postbattle"
          subtitle={`Session #${battleId ?? "-"}${battleState.battle.scenario ? ` - ${battleState.battle.scenario}` : ""}`}
        />
      ) : null}

      <PostbattleSection isMobile={isMobile}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground">Exploration</p>
          </div>
          <div className="flex items-center gap-3">
            {isSavingDraft ? <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Saving draft...</p> : null}
            {draftError ? <p className="text-sm text-red-600">{draftError}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[9rem] flex-1 space-y-1 sm:max-w-[12rem]">
            <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Dice Count</span>
            <CommittedNumberInput
              value={localExploration?.diceCount ?? 0}
              min={0}
              max={10}
              fallbackValue={0}
              className="h-10"
              disabled={isFinalized || !localExploration}
              onCommit={handleCommitDiceCount}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            className="h-10 min-w-24"
            disabled={
              isFinalized ||
              !localExploration ||
              localExploration.hasRolledAllDice ||
              localExploration.diceCount === 0
            }
            onClick={() =>
              localExploration &&
              setLocalExploration(rollAllLocalExplorationDice(localExploration))
            }
          >
            Roll
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          {(localExploration?.diceValues ?? []).map((dieValue, index) => (
            <div
              key={`exploration-die-${index}`}
              className="flex w-fit items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2"
            >
              <label className="flex min-w-10 flex-col items-center gap-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                <span>D{index + 1}</span>
                <Checkbox
                  checked={Boolean(localExploration?.selectedDice[index])}
                  disabled={
                    isFinalized ||
                    !localExploration ||
                    (!localExploration.selectedDice[index] &&
                      localExploration.selectedDice.filter(Boolean).length >= 6)
                  }
                  onChange={(event) =>
                    localExploration &&
                    setLocalExploration(
                      setLocalExplorationDieSelected(localExploration, index, event.target.checked)
                    )
                  }
                />
              </label>
              <Input
                value={dieValue ?? ""}
                placeholder="-"
                inputMode="numeric"
                disabled={isFinalized}
                className="h-10 w-10 min-w-10 max-w-10 flex-none px-0 text-center text-base font-semibold"
                onChange={(event) =>
                  localExploration &&
                  setLocalExploration(
                    setLocalExplorationDieValue(localExploration, index, event.target.value)
                  )
                }
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-10 w-10 shrink-0"
                disabled={isFinalized || !localExploration}
                onClick={() =>
                  localExploration &&
                  setLocalExploration(rerollLocalExplorationDie(localExploration, index))
                }
                aria-label={`Reroll die ${index + 1}`}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Exploration Reward</span>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[7rem_minmax(0,14rem)]">
            <div className="flex h-10 items-center rounded-md border border-border/60 bg-background/80 px-3 text-sm text-foreground">
              {explorationAmount}
            </div>
            <select
              value={localExploration?.resourceId ?? ""}
              disabled={isFinalized || resources.length === 0 || !localExploration}
              onChange={(event) =>
                localExploration &&
                setLocalExploration(
                  setLocalExplorationResource(
                    localExploration,
                    event.target.value ? Number(event.target.value) : null
                  )
                )
              }
              className="h-10 w-full max-w-full border border-border/60 bg-background/80 px-3 text-sm text-foreground sm:max-w-[14rem]"
            >
              {resources.length === 0 ? <option value="">No resources</option> : null}
              {resources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </PostbattleSection>

      <PostbattleSection isMobile={isMobile}>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground">Roster</p>
        </div>
        {currentRosterLoading ? <p className="text-sm text-muted-foreground">Loading roster...</p> : null}
        {currentRosterError ? <p className="text-sm text-red-600">{currentRosterError}</p> : null}
        {groups.map((group, index) => {
          const showHenchmenTitle =
            group.unitKind === "henchman" &&
            (index === 0 || groups[index - 1]?.unitKind !== "henchman");
          return (
          <div key={group.key} className="space-y-3">
            {showHenchmenTitle ? (
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground">Henchmen</p>
            ) : null}
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{group.label}</p>
              {group.unitKind === "henchman" && group.rows[0] ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">XP
                  <CommittedNumberInput
                    className="h-9 w-24"
                    value={group.rows[0].xpEarned}
                    min={0}
                    fallbackValue={0}
                    disabled={isFinalized}
                    onCommit={(nextXp) => handleCommitGroupXp(group.label, nextXp)}
                  />
                </label>
              ) : null}
            </div>
            {group.rows.map((row) => {
              return (
                <div
                  key={row.unitKey}
                  className={`rounded-xl border bg-background/75 p-3 ${
                    row.outOfAction ? "border-red-600/70" : "border-border/60"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{row.unitName}</p>
                        <p className="text-xs text-muted-foreground">{row.unitType}</p>
                        {row.groupName ? <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{row.groupName}</p> : null}
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-end gap-4">
                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Kills</p>
                            <p className="text-sm text-foreground">{row.killCount}</p>
                          </div>
                          <label className="space-y-1">
                            <span className="block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">XP</span>
                          <CommittedNumberInput
                            value={row.xpEarned}
                            min={0}
                            fallbackValue={0}
                            disabled={isFinalized || row.unitKind === "henchman"}
                            onCommit={(nextXp) => handleCommitUnitXp(row.unitKey, nextXp)}
                            className="h-9 w-full max-w-[5.5rem]"
                          />
                          </label>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <Checkbox checked={row.dead} disabled={isFinalized} onChange={(event) => void handleToggleDead(row, event.target.checked)} />
                          Dead
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {row.outOfAction ? <Button type="button" size="sm" variant="secondary" className="h-9" disabled={isFinalized} onClick={() => setRollTarget({ unitKey: row.unitKey, unitName: row.unitName, unitKind: row.unitKind })}>Serious Injury Roll</Button> : null}
                    </div>
                  </div>
                  {row.seriousInjuryRolls.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{row.seriousInjuryRolls.map((roll, index) => <div key={`${row.unitKey}-roll-${index}`} className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">{`${roll.roll_type.toUpperCase()} ${roll.result_code}: ${roll.result_label}`}</div>)}</div> : null}
                </div>
              );
            })}
          </div>
        )})}
      </PostbattleSection>

      {!isMobile ? (
        <div className="fixed inset-x-0 bottom-4 z-20 px-3 min-[960px]:left-auto min-[960px]:right-4 min-[960px]:inset-x-auto min-[960px]:w-[520px]">
          <CardBackground className="space-y-2 p-3">
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isFinalized || isFinalizing || isLeaving || isSavingDraft}
                onClick={() => void handleLeaveWithoutSaving()}
              >
                {isLeaving ? "Leaving..." : "Leave Without Saving"}
              </Button>
              <Button
                type="button"
                disabled={isFinalized || isFinalizing || isLeaving || isSavingDraft || !canFinalize}
                onClick={() => setIsFinalizeModalOpen(true)}
              >
                {isFinalizing ? "Finalising..." : isFinalized ? "Finalised" : "Finalise Postbattle"}
              </Button>
            </div>
          </CardBackground>
        </div>
      ) : null}

      <SeriousInjuryRollDialog target={rollTarget} heroRollType={heroDeathRoll} open={Boolean(rollTarget)} disabled={isFinalized || isSavingDraft} onOpenChange={(open) => !open && setRollTarget(null)} onRoll={() => void handleRollSeriousInjury()} />
      <Dialog open={isFinalizeModalOpen} onOpenChange={setIsFinalizeModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Finalise Postbattle</DialogTitle>
            <DialogDescription>
              Review the permanent changes that will be applied to {currentParticipant.warband.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Exploration</p>
              <p className="mt-2 text-sm text-foreground">
                {finalizeSummary.resourceName ? (
                  <>
                    You will gain {finalizeSummary.resourceAmount}{" "}
                    <span className="text-accent">{finalizeSummary.resourceName}</span>
                    .
                  </>
                ) : (
                  "No resource will be updated."
                )}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Deaths</p>
              {finalizeSummary.deaths.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {finalizeSummary.deaths.map((row) => (
                    <p key={`death-${row.unitKey}`} className="text-sm text-foreground">
                      {row.unitName} will be marked dead.
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No units are marked dead.</p>
              )}
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">XP Awards</p>
              {finalizeSummary.xpAwards.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {finalizeSummary.xpAwards.map((row) => (
                    <p key={`xp-${row.unitKey}`} className="text-sm text-foreground">
                      {row.unitName} will gain {row.xpEarned} XP.
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No XP awards are currently set.</p>
              )}
            </div>
            {draftError ? <p className="text-sm text-red-600">{draftError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsFinalizeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleFinalize()}
              disabled={isFinalized || isFinalizing || isLeaving || isSavingDraft || !canFinalize}
            >
              {isFinalizing ? "Finalising..." : "Confirm Finalise"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
