import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { finalizeBattlePostbattle, getBattleState, saveBattlePostbattleDraft } from "@/features/battles/api/battles-api";
import {
  buildPostbattleDraft,
  buildRenderableGroups,
  getExplorationGuide,
  isPostbattleDraftValid,
  rollD6Death,
  rollHeroDeath,
  updateGroupXp,
  updateUnitResult,
  type PostbattleRenderableRow,
} from "@/features/battles/components/postbattle/postbattle-utils";
import { usePrebattleRosters } from "@/features/battles/components/prebattle/usePrebattleRosters";
import type { BattlePostbattleState, BattleState } from "@/features/battles/types/battle-types";
import type { BattleLayoutContext } from "@/features/battles/routes/BattleLayout";
import { useAuth } from "@/features/auth/hooks/use-auth";
import CreateSpecialDialog from "@/features/special/components/CreateSpecialDialog";
import type { Special } from "@/features/special/types/special-types";
import { listWarbandResources } from "@/features/warbands/api/warbands-resources";
import SearchableDropdown from "@/features/warbands/components/shared/forms/SearchableDropdown";
import { useCampaignSpecial } from "@/features/warbands/hooks/campaign/useCampaignSpecial";
import type { WarbandResource } from "@/features/warbands/types/warband-types";
import { createBattleSessionSocket } from "@/lib/realtime";
import { useMediaQuery } from "@/lib/use-media-query";

type RollTarget = { unitKey: string; unitName: string; unitKind: "hero" | "hired_sword" | "henchman" } | null;

function DeathRollDialog({
  target,
  open,
  disabled,
  onOpenChange,
  onRoll,
}: {
  target: RollTarget;
  open: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onRoll: () => void;
}) {
  if (!target) return null;
  const isHero = target.unitKind === "hero";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Death Roll</DialogTitle>
          <DialogDescription>
            {isHero
              ? `Roll a D66 guide for ${target.unitName}.`
              : `Roll a D6 for ${target.unitName}. A 1-2 suggests death; 3-6 suggests survival.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="justify-start">
          <Button type="button" onClick={onRoll} disabled={disabled}>{isHero ? "Roll D66" : "Roll D6"}</Button>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BattlePostbattle() {
  const { id, battleId } = useParams();
  const navigate = useNavigate();
  const { setBattleMobileTopBar, setBattleMobileBottomBar } = useOutletContext<BattleLayoutContext>();
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const campaignId = Number(id);
  const numericBattleId = Number(battleId);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [resources, setResources] = useState<WarbandResource[]>([]);
  const [draft, setDraft] = useState<BattlePostbattleState | null>(null);
  const [draftError, setDraftError] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [rollTarget, setRollTarget] = useState<RollTarget>(null);
  const [specialEditorUnitKey, setSpecialEditorUnitKey] = useState<string | null>(null);
  const [specialQuery, setSpecialQuery] = useState("");
  const [isCreateSpecialOpen, setIsCreateSpecialOpen] = useState(false);
  const { rosters, rosterLoading, rosterErrors } = usePrebattleRosters(battleState?.participants);
  const { availableSpecials, setAvailableSpecials, isSpecialsLoading } = useCampaignSpecial({
    campaignId,
    hasCampaignId: !Number.isNaN(campaignId),
  });

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
    setDraft(buildPostbattleDraft(battleState.battle, currentParticipant, currentRoster, resources));
  }, [battleState?.battle, currentParticipant?.id, currentParticipant?.postbattle_json, currentParticipant?.unit_information_json, currentParticipant?.selected_unit_keys_json, currentRoster, resources]);

  const persistDraft = useCallback(async (nextDraft: BattlePostbattleState) => {
    setDraft(nextDraft);
    setIsSavingDraft(true);
    setDraftError("");
    try {
      const next = await saveBattlePostbattleDraft(campaignId, numericBattleId, { postbattle_json: nextDraft });
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

  const handleRollDeath = useCallback(async () => {
    if (!draft || !rollTarget) return;
    const roll = rollTarget.unitKind === "hero" ? rollHeroDeath() : rollD6Death();
    setRollTarget(null);
    await persistDraft(
      updateUnitResult(draft, rollTarget.unitKey, (current) => ({
        ...current,
        dead: roll.dead_suggestion ? true : current.dead,
        death_rolls: [...current.death_rolls, roll],
      }))
    );
  }, [draft, persistDraft, rollTarget]);

  const matchingSpecials = useMemo(() => {
    const query = specialQuery.trim().toLowerCase();
    const selectedIds = new Set(
      specialEditorUnitKey && draft ? draft.unit_results[specialEditorUnitKey]?.special_ids ?? [] : []
    );
    return availableSpecials
      .filter((special) => !selectedIds.has(special.id))
      .filter((special) => !query || special.name.toLowerCase().includes(query) || (special.type ?? "").toLowerCase().includes(query))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [availableSpecials, draft, specialEditorUnitKey, specialQuery]);

  const handleAddSpecial = useCallback(async (special: Special) => {
    if (!draft || !specialEditorUnitKey) return;
    setSpecialQuery("");
    await persistDraft(
      updateUnitResult(draft, specialEditorUnitKey, (current) => ({
        ...current,
        special_ids: current.special_ids.includes(special.id) ? current.special_ids : [...current.special_ids, special.id],
      }))
    );
  }, [draft, persistDraft, specialEditorUnitKey]);

  const handleRemoveSpecial = useCallback(async (unitKey: string, specialId: number) => {
    if (!draft) return;
    await persistDraft(
      updateUnitResult(draft, unitKey, (current) => ({
        ...current,
        special_ids: current.special_ids.filter((entry) => entry !== specialId),
      }))
    );
  }, [draft, persistDraft]);

  const handleFinalize = useCallback(async () => {
    if (!draft || !currentParticipant) return;
    setIsFinalizing(true);
    setDraftError("");
    try {
      await finalizeBattlePostbattle(campaignId, numericBattleId, { postbattle_json: draft });
      setIsFinalizeModalOpen(false);
      navigate(`/campaigns/${campaignId}/warbands/${currentParticipant.warband.id}`, { replace: true });
    } catch (errorResponse) {
      setDraftError(errorResponse instanceof Error ? errorResponse.message || "Unable to finalise postbattle" : "Unable to finalise postbattle");
    } finally {
      setIsFinalizing(false);
    }
  }, [campaignId, currentParticipant, draft, navigate, numericBattleId]);

  const groups = useMemo(() => (draft ? buildRenderableGroups(draft) : []), [draft]);
  const winnerNames = useMemo(() => {
    const winnerIds = new Set(battleState?.battle.winner_warband_ids_json ?? []);
    return (battleState?.participants ?? [])
      .filter((participant) => winnerIds.has(participant.warband.id))
      .map((participant) => participant.warband.name);
  }, [battleState?.battle.winner_warband_ids_json, battleState?.participants]);
  const finalizeSummary = useMemo(() => {
    const rows = groups.flatMap((group) => group.rows);
    const deaths = rows.filter((row) => row.dead);
    const xpAwards = rows
      .filter((row) => row.xpEarned > 0)
      .map((row) => ({ unitKey: row.unitKey, unitName: row.unitName, xpEarned: row.xpEarned }));
    const injuryAssignments = rows
      .filter((row) => row.unitKind === "hero" && row.specialIds.length > 0)
      .map((row) => ({
        unitKey: row.unitKey,
        unitName: row.unitName,
        specialNames: row.specialIds
          .map((specialId) => availableSpecials.find((special) => special.id === specialId)?.name)
          .filter((entry): entry is string => Boolean(entry)),
      }))
      .filter((entry) => entry.specialNames.length > 0);
    const selectedResource =
      resources.find((resource) => resource.id === draft?.exploration.resource_id) ?? null;

    return {
      deaths,
      xpAwards,
      injuryAssignments,
      shards: draft?.exploration.shard_total ?? 0,
      resourceName: selectedResource?.name ?? null,
      diceCount: draft?.exploration.dice.length ?? 0,
    };
  }, [availableSpecials, draft?.exploration.dice.length, draft?.exploration.resource_id, draft?.exploration.shard_total, groups, resources]);
  const specialTypeOptions = useMemo(
    () => Array.from(new Set(availableSpecials.map((entry) => entry.type?.trim()).filter((entry): entry is string => Boolean(entry)))).sort((left, right) => left.localeCompare(right)),
    [availableSpecials]
  );

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
        disabled: isFinalized || isFinalizing || isSavingDraft || !isPostbattleDraftValid(draft),
        variant: "default",
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
    isFinalized,
    isFinalizing,
    isMobile,
    isSavingDraft,
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
        <PageHeader title="Postbattle" subtitle={`Session #${battleId ?? "-"}${battleState.battle.title ? ` - ${battleState.battle.title}` : ""}`} />
      ) : null}

      <CardBackground className="space-y-2 p-3 sm:p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Battle Result</p>
        <p className="text-sm text-foreground">
          {winnerNames.length > 0 ? `Winners: ${winnerNames.join(", ")}` : "No winners declared."}
        </p>
        {draftError ? <p className="text-sm text-red-600">{draftError}</p> : null}
      </CardBackground>

      <CardBackground className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Exploration</p>
            <p className="text-sm text-muted-foreground">{getExplorationGuide(draft?.exploration.dice ?? [])}</p>
          </div>
          {isSavingDraft ? <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Saving draft...</p> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(draft?.exploration.dice ?? []).map((die) => (
            <div key={die.key} className="rounded-xl border border-border/60 bg-background/70 p-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{die.source === "winner_bonus" ? "Winner Bonus" : "Hero Die"}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{die.value}</p>
              <Button type="button" size="sm" variant="secondary" className="mt-3" disabled={isFinalized || isSavingDraft} onClick={() => draft && void persistDraft({ ...draft, exploration: { ...draft.exploration, dice: draft.exploration.dice.map((entry) => entry.key === die.key ? { ...entry, value: Math.floor(Math.random() * 6) + 1 } : entry) } })}>Reroll</Button>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Exploration Reward</span>
          <div className="grid gap-3 md:grid-cols-[minmax(0,140px)_minmax(0,1fr)]">
            <Input
              type="number"
              min={0}
              value={draft?.exploration.shard_total ?? 0}
              disabled={isFinalized}
              onChange={(event) =>
                draft &&
                setDraft({
                  ...draft,
                  exploration: {
                    ...draft.exploration,
                    shard_total: Math.max(0, Number(event.target.value) || 0),
                  },
                })
              }
              onBlur={() => draft && void persistDraft(draft)}
            />
            <select
              value={draft?.exploration.resource_id ?? ""}
              disabled={isFinalized || resources.length === 0}
              onChange={(event) =>
                draft &&
                void persistDraft({
                  ...draft,
                  exploration: {
                    ...draft.exploration,
                    resource_id: event.target.value ? Number(event.target.value) : null,
                  },
                })
              }
              className="h-10 w-full border border-border/60 bg-background/80 px-3 text-sm text-foreground"
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
      </CardBackground>

      <CardBackground className="space-y-4 p-4 sm:p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Roster</p>
          <p className="text-sm text-muted-foreground">Kills and OOA come from the battle. XP, death state, and hero injuries are editable here.</p>
        </div>
        {currentRosterLoading ? <p className="text-sm text-muted-foreground">Loading roster...</p> : null}
        {currentRosterError ? <p className="text-sm text-red-600">{currentRosterError}</p> : null}
        {groups.map((group) => (
          <div key={group.key} className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground">{group.label}</p>
              {group.unitKind === "henchman" && group.rows[0] ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">XP
                  <Input type="number" min={0} className="h-9 w-24" value={group.rows[0].xpEarned} disabled={isFinalized} onChange={(event) => draft && setDraft(updateGroupXp(draft, group.label, Math.max(0, Number(event.target.value) || 0)))} onBlur={() => draft && void persistDraft(draft)} />
                </label>
              ) : null}
            </div>
            {group.rows.map((row) => {
              const selectedSpecials = availableSpecials.filter((special) => row.specialIds.includes(special.id));
              return (
                <div key={row.unitKey} className="rounded-xl border border-border/60 bg-background/75 p-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,0.7fr))_auto] lg:items-center">
                    <div className="min-w-0"><p className="font-semibold text-foreground">{row.unitName}</p><p className="text-xs text-muted-foreground">{row.unitType}</p>{row.groupName ? <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{row.groupName}</p> : null}</div>
                    <div><p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Kills</p><p className="text-sm text-foreground">{row.killCount}</p></div>
                    <label className="space-y-1"><span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">XP</span><Input type="number" min={0} value={row.xpEarned} disabled={isFinalized || row.unitKind === "henchman"} onChange={(event) => draft && setDraft(updateUnitResult(draft, row.unitKey, (current) => ({ ...current, xp_earned: Math.max(0, Number(event.target.value) || 0) })))} onBlur={() => draft && row.unitKind !== "henchman" && void persistDraft(draft)} className="h-9" /></label>
                    <div><p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">OOA</p><p className="text-sm text-foreground">{row.outOfAction ? "Yes" : "No"}</p></div>
                    <label className="flex items-center gap-2 pt-5 text-sm text-foreground"><Checkbox checked={row.dead} disabled={isFinalized} onChange={(event) => void handleToggleDead(row, event.target.checked)} />Dead</label>
                    <div className="flex flex-wrap justify-end gap-2">
                      {row.outOfAction ? <Button type="button" size="sm" variant="secondary" disabled={isFinalized} onClick={() => setRollTarget({ unitKey: row.unitKey, unitName: row.unitName, unitKind: row.unitKind })}>Death Roll</Button> : null}
                      {row.unitKind === "hero" ? <Button type="button" size="sm" variant="secondary" disabled={isFinalized || isSpecialsLoading} onClick={() => setSpecialEditorUnitKey((current) => current === row.unitKey ? null : row.unitKey)}>Add Injury</Button> : null}
                    </div>
                  </div>
                  {row.deathRolls.length > 0 ? <div className="mt-3 flex flex-wrap gap-2">{row.deathRolls.map((roll, index) => <div key={`${row.unitKey}-roll-${index}`} className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">{roll.roll_type === "d66" ? `D66 ${roll.result_code}: ${roll.result_label}` : `D6 ${roll.result_code}: ${roll.result_label}`}</div>)}</div> : null}
                  {row.unitKind === "hero" && specialEditorUnitKey === row.unitKey ? (
                    <div className="mt-3 space-y-3 rounded-xl border border-border/60 bg-background/60 p-3">
                      <SearchableDropdown query={specialQuery} onQueryChange={setSpecialQuery} placeholder="Search injuries..." inputClassName="h-10 w-full" items={matchingSpecials} isOpen={true} onBlur={() => setSpecialEditorUnitKey(null)} onSelectItem={(special) => void handleAddSpecial(special)} renderItem={(special) => <><span className="font-semibold">{special.name}</span><span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">{special.type || "Special"}</span></>} getItemKey={(special) => special.id} canCreate onCreateClick={() => setIsCreateSpecialOpen(true)} createLabel="Add special" />
                      {selectedSpecials.length > 0 ? <div className="flex flex-wrap gap-2">{selectedSpecials.map((special) => <button key={`${row.unitKey}-special-${special.id}`} type="button" className="rounded-full border border-border/60 px-3 py-1 text-xs text-foreground" onClick={() => void handleRemoveSpecial(row.unitKey, special.id)} disabled={isFinalized}>{special.name} x</button>)}</div> : <p className="text-xs text-muted-foreground">No injury specials added yet.</p>}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </CardBackground>

      <div className="flex justify-end">
        {!isMobile ? (
          <Button
            type="button"
            disabled={isFinalized || isFinalizing || isSavingDraft || !isPostbattleDraftValid(draft)}
            onClick={() => setIsFinalizeModalOpen(true)}
          >
            {isFinalizing ? "Finalising..." : isFinalized ? "Finalised" : "Finalise Postbattle"}
          </Button>
        ) : null}
      </div>

      <DeathRollDialog target={rollTarget} open={Boolean(rollTarget)} disabled={isFinalized || isSavingDraft} onOpenChange={(open) => !open && setRollTarget(null)} onRoll={() => void handleRollDeath()} />
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
                    You will gain {finalizeSummary.shards}{" "}
                    <span className="text-accent">{finalizeSummary.resourceName}</span>
                    .
                  </>
                ) : (
                  `${finalizeSummary.diceCount} exploration dice rolled. No resource will be updated.`
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
            <div className="rounded-xl border border-border/60 bg-background/60 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Hero Injuries</p>
              {finalizeSummary.injuryAssignments.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {finalizeSummary.injuryAssignments.map((entry) => (
                    <p key={`injury-${entry.unitKey}`} className="text-sm text-foreground">
                      {entry.unitName}: {entry.specialNames.join(", ")}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No hero injury specials will be added.</p>
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
              disabled={isFinalized || isFinalizing || isSavingDraft || !isPostbattleDraftValid(draft)}
            >
              {isFinalizing ? "Finalising..." : "Confirm Finalise"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateSpecialDialog campaignId={campaignId} onCreated={(special) => { setAvailableSpecials((prev) => prev.some((entry) => entry.id === special.id) ? prev : [...prev, special]); setIsCreateSpecialOpen(false); void handleAddSpecial(special); }} typeOptions={specialTypeOptions} open={isCreateSpecialOpen} onOpenChange={setIsCreateSpecialOpen} trigger={null} />
    </div>
  );
}
