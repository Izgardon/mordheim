import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Info, RotateCcw, X } from "lucide-react";

import DiceRoller from "@/components/dice/DiceRoller";
import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import { Checkbox } from "@/components/ui/checkbox";
import { CommittedNumberInput } from "@/components/ui/committed-number-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { NumberInput } from "@/components/ui/number-input";
import { Tooltip } from "@/components/ui/tooltip";
import { confirmBattlePostbattle, finalizeBattlePostbattle, getBattleState, saveBattlePostbattleDraft } from "@/features/battles/api/battles-api";
import {
  addPostbattleFindItem,
  buildD6SeriousInjuryRoll,
  buildHeroSeriousInjuryRoll,
  buildLocalExplorationState,
  buildPostbattleDraft,
  buildRenderableGroups,
  removePostbattleFindItem,
  setPostbattleFindsGold,
  getExplorationResourceAmount,
  getPostbattleUpkeepTotal,
  getSelectedExplorationDiceValues,
  isPostbattleDraftValid,
  setPostbattlePayUpkeep,
  setLocalExplorationDiceCount,
  setLocalExplorationDieValue,
  setLocalExplorationDieSelected,
  setLocalExplorationResource,
  toPostbattleExplorationPayload,
  updateGroupXp,
  updatePostbattleUpkeepEntry,
  updateUnitResult,
  type LocalExplorationState,
  type PostbattleRenderableRow,
} from "@/features/battles/components/postbattle/postbattle-utils";
import { usePrebattleRosters } from "@/features/battles/components/prebattle/usePrebattleRosters";
import {
  HELPER_DIALOG_CONTENT_CLASS,
  HELPER_NATIVE_SELECT_CLASS,
  HELPER_NATIVE_SELECT_STYLE,
} from "@/features/battles/components/shared/battle-dialog-styles";
import BattleDesktopSubnav from "@/features/battles/components/shared/BattleDesktopSubnav";
import { listItems } from "@/features/items/api/items-api";
import type { Item } from "@/features/items/types/item-types";
import type { BattlePostbattleState, BattleState } from "@/features/battles/types/battle-types";
import type { BattleLayoutContext } from "@/features/battles/routes/BattleLayout";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { listWarbandResources } from "@/features/warbands/api/warbands-resources";
import type { WarbandResource } from "@/features/warbands/types/warband-types";
import { createBattleSessionSocket } from "@/lib/realtime";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

type RollTarget = { unitKey: string; unitName: string; unitKind: "hero" | "hired_sword" | "henchman" } | null;
type UpkeepRow = {
  unitKey: string;
  unitName: string;
  unitType: string;
  cost: number | null;
  costExpression: string | null;
  hasFixedCost: boolean;
  dead: boolean;
};

type PostbattleSectionKey = "exploration" | "roster" | "finds" | "upkeep";

const POSTBATTLE_SECTION_LABELS: Record<PostbattleSectionKey, string> = {
  exploration: "Exploration",
  roster: "Roster",
  finds: "Finds",
  upkeep: "Upkeep",
};

const getPostbattleSectionId = (section: PostbattleSectionKey) =>
  `battle-postbattle-section-${section}`;

const EXPLORATION_SHARD_TABLE = [
  { diceResult: "1-5", shardsFound: "1" },
  { diceResult: "6-11", shardsFound: "2" },
  { diceResult: "12-17", shardsFound: "3" },
  { diceResult: "18-24", shardsFound: "4" },
  { diceResult: "25-30", shardsFound: "5" },
  { diceResult: "31-35", shardsFound: "6" },
  { diceResult: "36+", shardsFound: "7" },
] as const;

const parseDiceValues = (results: unknown): number[] => {
  const extractValues = (entry: unknown): number[] => {
    if (!entry) {
      return [];
    }
    if (typeof entry === "number") {
      return Number.isFinite(entry) ? [entry] : [];
    }
    if (entry && typeof entry === "object" && "rolls" in entry) {
      const rolls = (entry as { rolls?: unknown }).rolls;
      if (Array.isArray(rolls)) {
        return rolls
          .map((roll) => {
            if (typeof roll === "number") {
              return roll;
            }
            if (roll && typeof roll === "object" && "value" in roll) {
              const value = Number((roll as { value?: unknown }).value);
              return Number.isFinite(value) ? value : null;
            }
            return null;
          })
          .filter((value): value is number => Number.isFinite(value));
      }
    }
    if (entry && typeof entry === "object" && "value" in entry) {
      const value = Number((entry as { value?: unknown }).value);
      return Number.isFinite(value) ? [value] : [];
    }
    return [];
  };

  if (Array.isArray(results)) {
    return results.flatMap(extractValues);
  }

  return extractValues(results);
};

const getSeriousInjuryNotation = (
  target: RollTarget,
  heroRollType: "d66" | "d100"
) => {
  if (!target) {
    return "1d6";
  }
  if (target.unitKind === "hero") {
    return heroRollType === "d100" ? "1d100" : "2d6";
  }
  return "1d6";
};

const toD6Values = (results: unknown, expectedCount?: number) =>
  parseDiceValues(results)
    .map((value) => Math.max(1, Math.min(6, Math.trunc(value || 1))))
    .slice(0, expectedCount ?? Number.POSITIVE_INFINITY);

function SeriousInjuryRollDialog({
  target,
  heroRollType,
  themeColor,
  open,
  disabled,
  onOpenChange,
  onRollComplete,
  onRollingChange,
}: {
  target: RollTarget;
  heroRollType: "d66" | "d100";
  themeColor: string;
  open: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onRollComplete: (results: unknown) => void;
  onRollingChange: (isRolling: boolean) => void;
}) {
  if (!target) return null;
  const isHero = target.unitKind === "hero";
  const heroRollLabel = heroRollType.toUpperCase();
  const notation = getSeriousInjuryNotation(target, heroRollType);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-lg ${HELPER_DIALOG_CONTENT_CLASS}`}>
        <DialogHeader>
          <DialogTitle>Serious Injury Roll</DialogTitle>
          <DialogDescription>
            {isHero
              ? `Roll a ${heroRollLabel} guide for ${target.unitName}.`
              : `Roll a D6 for ${target.unitName}. A 1-2 suggests death; 3-6 suggests survival.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <DiceRoller
            mode="fixed"
            fixedNotation={notation}
            fullScreen
            themeColor={themeColor}
            resultMode={notation === "2d6" ? "both" : "total"}
            showResultBox
            showRollLabel={false}
            rollDisabled={disabled}
            onRollComplete={onRollComplete}
            onRollingChange={onRollingChange}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PostbattleStepperInput({
  value,
  min = 0,
  max,
  disabled,
  onCommit,
}: {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(() => String(value));
  const [isFocused, setIsFocused] = useState(false);
  const isMobile = useMediaQuery("(max-width: 960px)");

  useEffect(() => {
    if (!isFocused) {
      setDraftValue(String(value));
    }
  }, [isFocused, value]);

  const normalizeValue = useCallback(
    (rawValue: string) => {
      const parsed = Number(rawValue);
      let nextValue = Number.isFinite(parsed) ? Math.trunc(parsed) : value;
      nextValue = Math.max(min, nextValue);
      if (typeof max === "number") {
        nextValue = Math.min(max, nextValue);
      }
      return nextValue;
    },
    [max, min, value]
  );

  const commitValue = useCallback(() => {
    const nextValue = normalizeValue(draftValue);
    setDraftValue(String(nextValue));
    onCommit(nextValue);
  }, [draftValue, normalizeValue, onCommit]);

  return (
    <NumberInput
      value={draftValue}
      min={min}
      max={max}
      step={1}
      disabled={disabled}
      compact
      inputSize="sm"
      className={isMobile ? "w-10 !px-0 text-center text-sm" : "w-[5rem] !px-2 text-left text-sm"}
      containerClassName="h-9"
      onChange={(event) => setDraftValue(event.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        commitValue();
      }}
    />
  );
}

function PostbattleSection({
  id,
  isMobile,
  className,
  children,
}: {
  id: string;
  isMobile: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (isMobile) {
    return (
      <section id={id} className={cn("space-y-4", className)}>
        {children}
      </section>
    );
  }

  return (
    <CardBackground
      as="section"
      id={id}
      className={cn("battle-card space-y-4 p-4 sm:p-5", className)}
    >
      {children}
    </CardBackground>
  );
}

function ExplorationInfoTooltip() {
  return (
    <Tooltip
      trigger={
        <Button
          type="button"
          variant="icon"
          size="icon"
          className="h-8 w-8 border-none bg-transparent p-0 shadow-none hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label="Show exploration shard table"
        >
          <Info className="h-4 w-4" />
        </Button>
      }
      minWidth={260}
      contentClassName="tooltip-unfurl fixed z-[60] overflow-y-auto rounded-sm border border-border/70 bg-popover p-3 text-sm text-popover-foreground shadow-lg"
      content={
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Shards Found
          </p>
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border border-border/60 bg-black/20 text-foreground">
                <th className="border border-border/60 px-3 py-2 font-semibold">Dice Result</th>
                <th className="border border-border/60 px-3 py-2 font-semibold">Shards Found</th>
              </tr>
            </thead>
            <tbody>
              {EXPLORATION_SHARD_TABLE.map((row) => (
                <tr key={row.diceResult} className="border border-border/60">
                  <td className="border border-border/60 px-3 py-2 text-foreground">
                    {row.diceResult}
                  </td>
                  <td className="border border-border/60 px-3 py-2 text-foreground">
                    {row.shardsFound}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    />
  );
}

const resolveFindItemCost = (item: Item) => {
  const availabilities = Array.isArray(item.availabilities) ? item.availabilities : [];
  const costs = availabilities
    .map((availability) => availability?.cost)
    .filter((cost): cost is number => typeof cost === "number" && Number.isFinite(cost))
    .map((cost) => Math.max(0, Math.trunc(cost)));

  if (costs.length === 0) {
    return null;
  }

  return Math.min(...costs);
};

const getItemAvailabilityCostLabel = (item: Item) => {
  const availabilities = Array.isArray(item.availabilities) ? item.availabilities : [];
  const costs = availabilities
    .map((availability) => availability?.cost)
    .filter((cost): cost is number => typeof cost === "number" && Number.isFinite(cost))
    .map((cost) => `${Math.max(0, Math.trunc(cost))} gc`);

  if (costs.length === 0) {
    return "No base cost";
  }

  return costs.join(" / ");
};

export default function BattlePostbattle() {
  const { id, battleId } = useParams();
  const navigate = useNavigate();
  const { campaign, setBattleMobileTopBar, setBattleMobileBottomBar } = useOutletContext<BattleLayoutContext>();
  const { user } = useAuth();
  const { diceColor, clearCurrentBattleSession } = useAppStore();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const campaignId = Number(id);
  const numericBattleId = Number(battleId);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [resources, setResources] = useState<WarbandResource[]>([]);
  const [isResourcesLoading, setIsResourcesLoading] = useState(false);
  const [draft, setDraft] = useState<BattlePostbattleState | null>(null);
  const [localExploration, setLocalExploration] = useState<LocalExplorationState | null>(null);
  const [localExplorationKey, setLocalExplorationKey] = useState<string | null>(null);
  const [draftError, setDraftError] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
  const [rollTarget, setRollTarget] = useState<RollTarget>(null);
  const [isSeriousInjuryRolling, setIsSeriousInjuryRolling] = useState(false);
  const [explorationRollSignal, setExplorationRollSignal] = useState(0);
  const [explorationRerollSignal, setExplorationRerollSignal] = useState(0);
  const [explorationRerollIndex, setExplorationRerollIndex] = useState<number | null>(null);
  const [isExplorationRolling, setIsExplorationRolling] = useState(false);
  const [selectedSection, setSelectedSection] = useState<PostbattleSectionKey>("exploration");
  const [isFindItemDropdownOpen, setIsFindItemDropdownOpen] = useState(false);
  const [findItemSearch, setFindItemSearch] = useState("");
  const [findItemResults, setFindItemResults] = useState<Item[]>([]);
  const [isFindItemLoading, setIsFindItemLoading] = useState(false);
  const [findItemSearchError, setFindItemSearchError] = useState("");
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
      setIsResourcesLoading(false);
      return;
    }
    let active = true;
    setIsResourcesLoading(true);
    listWarbandResources(currentParticipant.warband.id)
      .then((data) => active && setResources(data))
      .catch(() => active && setResources([]))
      .finally(() => active && setIsResourcesLoading(false));
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
          finds: nextDraft.finds,
          upkeep: nextDraft.upkeep,
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

  useEffect(() => {
    if (!isFindItemDropdownOpen) {
      return;
    }

    let active = true;
    const searchTerm = findItemSearch.trim();
    const timeoutHandle = window.setTimeout(() => {
      setIsFindItemLoading(true);
      setFindItemSearchError("");
      listItems({
        campaignId: Number.isNaN(campaignId) ? undefined : campaignId,
        search: searchTerm || undefined,
      })
        .then((items) => {
          if (!active) {
            return;
          }
          setFindItemResults(items);
        })
        .catch((errorResponse) => {
          if (!active) {
            return;
          }
          setFindItemResults([]);
          setFindItemSearchError(
            errorResponse instanceof Error
              ? errorResponse.message || "Unable to search items"
              : "Unable to search items"
          );
        })
        .finally(() => {
          if (active) {
            setIsFindItemLoading(false);
          }
        });
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timeoutHandle);
    };
  }, [campaignId, findItemSearch, isFindItemDropdownOpen]);

  const handleToggleDead = useCallback(async (row: PostbattleRenderableRow, checked: boolean) => {
    if (!draft) return;
    await persistDraft(updateUnitResult(draft, row.unitKey, (current) => ({ ...current, dead: checked })));
  }, [draft, persistDraft]);

  const handleRollSeriousInjury = useCallback(async (results: unknown) => {
    if (!draft || !rollTarget) return;
    const values = parseDiceValues(results);
    if (values.length === 0) {
      setDraftError("Unable to read serious injury roll.");
      return;
    }
    const roll =
      rollTarget.unitKind === "hero"
        ? buildHeroSeriousInjuryRoll(values, heroDeathRoll)
        : buildD6SeriousInjuryRoll(values[0]);
    setIsSeriousInjuryRolling(false);
    setRollTarget(null);
    await persistDraft(
      updateUnitResult(draft, rollTarget.unitKey, (current) => ({
        ...current,
        dead: roll.dead_suggestion ? true : current.dead,
        serious_injury_rolls: [...current.serious_injury_rolls, roll],
      }))
    );
  }, [draft, heroDeathRoll, persistDraft, rollTarget]);

  useEffect(() => {
    if (!rollTarget) {
      setIsSeriousInjuryRolling(false);
    }
  }, [rollTarget]);

  const handleExplorationRollComplete = useCallback((results: unknown) => {
    setIsExplorationRolling(false);
    setLocalExploration((current) => {
      if (!current) {
        return current;
      }
      const nextValues = toD6Values(results, current.diceCount);
      if (nextValues.length === 0) {
        setDraftError("Unable to read exploration roll.");
        return current;
      }
      return {
        ...current,
        hasRolledAllDice: true,
        diceValues: current.diceValues.map((value, index) => nextValues[index] ?? value),
      };
    });
  }, []);

  const handleExplorationRerollComplete = useCallback((results: unknown) => {
    setIsExplorationRolling(false);
    setLocalExploration((current) => {
      if (!current || explorationRerollIndex === null) {
        return current;
      }
      const [nextValue] = toD6Values(results, 1);
      if (!nextValue) {
        setDraftError("Unable to read exploration roll.");
        return current;
      }
      return {
        ...current,
        diceValues: current.diceValues.map((value, index) =>
          index === explorationRerollIndex ? nextValue : value
        ),
      };
    });
    setExplorationRerollIndex(null);
  }, [explorationRerollIndex]);

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

  const minimumUnitKillCounts = useMemo(() => {
    const unitInformation = currentParticipant?.unit_information_json ?? {};
    return Object.fromEntries(
      Object.entries(unitInformation).map(([unitKey, info]) => [
        unitKey,
        Math.max(0, Math.trunc(Number(info?.kill_count ?? 0) || 0)),
      ])
    );
  }, [currentParticipant?.unit_information_json]);

  const handleCommitUnitKillCount = useCallback((unitKey: string, nextKillCount: number) => {
    if (!draft) {
      return;
    }
    const minimumKillCount = minimumUnitKillCounts[unitKey] ?? 0;
    const normalizedKillCount = Math.max(minimumKillCount, nextKillCount);
    if (draft.unit_results[unitKey]?.kill_count === normalizedKillCount) {
      return;
    }
    void persistDraft(
      updateUnitResult(draft, unitKey, (current) => ({
        ...current,
        kill_count: normalizedKillCount,
      }))
    );
  }, [draft, minimumUnitKillCounts, persistDraft]);

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

  const handleCommitUpkeepCost = useCallback((unitKey: string, nextCost: number) => {
    if (!draft || draft.upkeep.entries[unitKey]?.cost === nextCost) {
      return;
    }
    void persistDraft(updatePostbattleUpkeepEntry(draft, unitKey, nextCost));
  }, [draft, persistDraft]);

  const handleTogglePayUpkeep = useCallback((checked: boolean) => {
    if (!draft || draft.upkeep.pay_upkeep === checked) {
      return;
    }
    void persistDraft(setPostbattlePayUpkeep(draft, checked));
  }, [draft, persistDraft]);

  const handleCommitFindsGold = useCallback((nextGoldCrowns: number) => {
    if (!draft || draft.finds.gold_crowns === nextGoldCrowns) {
      return;
    }
    void persistDraft(setPostbattleFindsGold(draft, nextGoldCrowns));
  }, [draft, persistDraft]);

  const handleAddFindItem = useCallback((item: Item) => {
    if (!draft) {
      return;
    }
    const baseCost = resolveFindItemCost(item);
    if (baseCost === null) {
      setDraftError(`${item.name} does not have an available cost and cannot be added to Finds.`);
      return;
    }
    void persistDraft(
      addPostbattleFindItem(draft, {
        item_id: item.id,
        name: item.name,
        type: item.type || null,
        cost: baseCost,
      })
    );
    setFindItemSearch("");
    setIsFindItemDropdownOpen(false);
  }, [draft, persistDraft]);

  const handleRemoveFindItem = useCallback((index: number) => {
    if (!draft) {
      return;
    }
    void persistDraft(removePostbattleFindItem(draft, index));
  }, [draft, persistDraft]);

  const handleExitPostbattle = useCallback(() => {
    clearCurrentBattleSession();
    window.dispatchEvent(
      new CustomEvent("battle:status-updated", {
        detail: {
          campaign_id: campaignId,
          battle_id: numericBattleId,
          status: "postbattle",
        },
      })
    );
    navigate(`/campaigns/${campaignId}/warband`, { replace: true });
  }, [campaignId, clearCurrentBattleSession, navigate, numericBattleId]);

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
      handleExitPostbattle();
    } catch (errorResponse) {
      setDraftError(errorResponse instanceof Error ? errorResponse.message || "Unable to finalise postbattle" : "Unable to finalise postbattle");
    } finally {
      setIsFinalizing(false);
    }
  }, [currentParticipant, draft, handleExitPostbattle, localExploration, campaignId, numericBattleId]);

  const handleLeaveWithoutSaving = useCallback(async () => {
    if (!currentParticipant) return;
    setIsLeaving(true);
    setDraftError("");
    try {
      await confirmBattlePostbattle(campaignId, numericBattleId);
      setIsFinalizeModalOpen(false);
      handleExitPostbattle();
    } catch (errorResponse) {
      setDraftError(errorResponse instanceof Error ? errorResponse.message || "Unable to leave postbattle" : "Unable to leave postbattle");
    } finally {
      setIsLeaving(false);
    }
  }, [campaignId, currentParticipant, handleExitPostbattle, numericBattleId]);

  const groups = useMemo(() => (draft ? buildRenderableGroups(draft) : []), [draft]);
  const upkeepRows = useMemo<UpkeepRow[]>(() => {
    if (!draft || !currentRoster) {
      return [];
    }

    return currentRoster.hiredSwords.map((hiredSword) => {
      const savedEntry = draft.upkeep.entries[hiredSword.key];
      return {
        unitKey: hiredSword.key,
        unitName: savedEntry?.unit_name ?? hiredSword.displayName,
        unitType: hiredSword.unitType,
        cost: typeof savedEntry?.cost === "number" ? savedEntry.cost : null,
        costExpression: hiredSword.upkeepCostExpression ?? null,
        hasFixedCost: typeof hiredSword.upkeepPrice === "number",
        dead: Boolean(draft.unit_results[hiredSword.key]?.dead),
      };
    });
  }, [currentRoster, draft]);
  const upkeepTotal = useMemo(() => getPostbattleUpkeepTotal(draft), [draft]);
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
      findsGoldCrowns: draft?.finds.gold_crowns ?? 0,
      findsItems: draft?.finds.items ?? [],
      resourceAmount: explorationAmount,
      resourceName: explorationResource?.name ?? null,
      upkeepRows: upkeepRows.filter((row) => !row.dead && typeof row.cost === "number"),
      upkeepTotal,
      payUpkeep: Boolean(draft?.upkeep.pay_upkeep),
    };
  }, [draft?.finds.gold_crowns, draft?.finds.items, draft?.upkeep.pay_upkeep, explorationAmount, explorationResource?.name, groups, upkeepRows, upkeepTotal]);
  const canFinalize = Boolean(draft && localExploration && isPostbattleDraftValid(draft));
  const mobileSectionOptions = useMemo(
    () => [
      { value: "exploration" as const, label: POSTBATTLE_SECTION_LABELS.exploration },
      { value: "roster" as const, label: POSTBATTLE_SECTION_LABELS.roster },
      { value: "finds" as const, label: POSTBATTLE_SECTION_LABELS.finds },
      ...(upkeepRows.length > 0
        ? [{ value: "upkeep" as const, label: POSTBATTLE_SECTION_LABELS.upkeep }]
        : []),
    ],
    [upkeepRows.length]
  );

  const handleSectionChange = useCallback((nextSectionValue: string) => {
    const nextSection = nextSectionValue as PostbattleSectionKey;
    setSelectedSection(nextSection);
    const sectionElement = document.getElementById(getPostbattleSectionId(nextSection));
    if (sectionElement) {
      sectionElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useEffect(() => {
    const validValues = new Set(mobileSectionOptions.map((option) => option.value));
    if (!validValues.has(selectedSection)) {
      setSelectedSection(mobileSectionOptions[0]?.value ?? "exploration");
    }
  }, [mobileSectionOptions, selectedSection]);

  useEffect(() => {
    if (!isMobile || mobileSectionOptions.length === 0) {
      return;
    }

    const topOffset = 116;
    let frameHandle = 0;

    const syncSectionFromScroll = () => {
      frameHandle = 0;

      let nextSection: PostbattleSectionKey | null = null;
      let bestPassedTop = Number.NEGATIVE_INFINITY;

      for (const option of mobileSectionOptions) {
        const sectionElement = document.getElementById(getPostbattleSectionId(option.value));
        if (!sectionElement) {
          continue;
        }
        const sectionTop = sectionElement.getBoundingClientRect().top - topOffset;
        if (sectionTop <= 0 && sectionTop > bestPassedTop) {
          bestPassedTop = sectionTop;
          nextSection = option.value;
        }
      }

      if (!nextSection) {
        let nearestAboveFold = Number.POSITIVE_INFINITY;
        for (const option of mobileSectionOptions) {
          const sectionElement = document.getElementById(getPostbattleSectionId(option.value));
          if (!sectionElement) {
            continue;
          }
          const sectionTop = sectionElement.getBoundingClientRect().top - topOffset;
          if (sectionTop >= 0 && sectionTop < nearestAboveFold) {
            nearestAboveFold = sectionTop;
            nextSection = option.value;
          }
        }
      }

      setSelectedSection((prev) => (nextSection && prev !== nextSection ? nextSection : prev));
    };

    const onScroll = () => {
      if (frameHandle !== 0) {
        return;
      }
      frameHandle = window.requestAnimationFrame(syncSectionFromScroll);
    };

    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (frameHandle !== 0) {
        window.cancelAnimationFrame(frameHandle);
      }
    };
  }, [isMobile, mobileSectionOptions]);

  useEffect(() => {
    if (!isMobile || !currentParticipant) {
      setBattleMobileTopBar?.(null);
      setBattleMobileBottomBar?.(null);
      return;
    }

    setBattleMobileTopBar?.({
      title: "Postbattle",
      onBack: () => setIsLeaveConfirmOpen(true),
      unitTypeOptions: mobileSectionOptions,
      selectedUnitTypeValue: selectedSection,
      onUnitTypeChange: handleSectionChange,
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
        onClick: () => setIsLeaveConfirmOpen(true),
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
    handleSectionChange,
    isFinalized,
    isFinalizing,
    isLeaving,
    isMobile,
    isSavingDraft,
    canFinalize,
    mobileSectionOptions,
    selectedSection,
    setBattleMobileBottomBar,
    setBattleMobileTopBar,
  ]);

  if (isLoading) return <LoadingScreen message="Loading postbattle..." />;
  if (error || !battleState) return <p className="text-sm text-red-600">{error || "Unable to load postbattle."}</p>;
  if (battleState.battle.status === "canceled" || battleState.battle.status === "ended") return <Navigate to={`/campaigns/${campaignId}`} replace />;
  if (battleState.battle.status === "prebattle") return <Navigate to={`/campaigns/${campaignId}/battles/${numericBattleId}/prebattle`} replace />;
  if (battleState.battle.status === "active") return <Navigate to={`/campaigns/${campaignId}/battles/${numericBattleId}/active`} replace />;
  if (!currentParticipant) return <p className="text-sm text-red-600">You are not part of this battle.</p>;
  if (!currentRosterError && (currentRosterLoading || isResourcesLoading || !currentRoster || !draft || !localExploration)) {
    return <LoadingScreen message="Loading postbattle..." />;
  }

  return (
    <div className="battle-page battle-postbattle-page min-h-0 space-y-4 px-2 pb-24 sm:px-0">
      {!isMobile ? (
        <BattleDesktopSubnav
          title={`${campaign?.name ?? "Campaign"} - Postbattle`}
          subtitle={`Session #${battleId ?? "-"}${battleState.battle.scenario ? ` - ${battleState.battle.scenario}` : ""}`}
          participants={[currentParticipant]}
          selectedParticipantUserId={currentParticipant.user.id}
          onSelectParticipant={() => undefined}
        />
      ) : null}

      <PostbattleSection id={getPostbattleSectionId("exploration")} isMobile={isMobile}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="battle-section-title">{POSTBATTLE_SECTION_LABELS.exploration}</p>
            <ExplorationInfoTooltip />
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
              className="field-surface h-10 !rounded-none"
              disabled={isFinalized || !localExploration}
              onCommit={handleCommitDiceCount}
              onFocus={(event) => {
                window.requestAnimationFrame(() => {
                  event.currentTarget.select();
                });
              }}
              onMouseUp={(event) => {
                event.preventDefault();
                event.currentTarget.select();
              }}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            className="h-10 min-w-24 md:h-11"
            disabled={
              isFinalized ||
              isExplorationRolling ||
              !localExploration ||
              localExploration.hasRolledAllDice ||
              localExploration.diceCount === 0
            }
            onClick={() => {
              setDraftError("");
              setExplorationRerollIndex(null);
              setExplorationRollSignal((prev) => prev + 1);
            }}
          >
            {isExplorationRolling && explorationRerollIndex === null ? "Rolling..." : "Roll"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          {(localExploration?.diceValues ?? []).map((dieValue, index) => (
            <div
              key={`exploration-die-${index}`}
              className="battle-inline-panel flex w-fit items-center gap-2 px-3 py-2"
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
                className="field-surface h-10 w-10 min-w-10 max-w-10 flex-none !rounded-none px-0 text-center text-base font-semibold"
                onFocus={(event) => {
                  window.requestAnimationFrame(() => {
                    event.currentTarget.select();
                  });
                }}
                onMouseUp={(event) => {
                  event.preventDefault();
                  event.currentTarget.select();
                }}
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
                disabled={isFinalized || !localExploration || isExplorationRolling}
                onClick={() => {
                  setDraftError("");
                  setExplorationRerollIndex(index);
                  setExplorationRerollSignal((prev) => prev + 1);
                }}
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
            <div className="battle-metric-box flex h-10 items-center px-3 text-sm text-foreground">
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
              className={`${HELPER_NATIVE_SELECT_CLASS} h-10 max-w-full px-3 sm:max-w-[14rem]`}
              style={HELPER_NATIVE_SELECT_STYLE}
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
        <DiceRoller
          mode="fixed"
          fixedNotation={`${Math.max(1, localExploration?.diceCount ?? 1)}d6`}
          fullScreen
          variant="button-only"
          showRollButton={false}
          themeColor={diceColor}
          rollSignal={explorationRollSignal}
          onRollComplete={handleExplorationRollComplete}
          onRollingChange={setIsExplorationRolling}
        />
        <DiceRoller
          mode="fixed"
          fixedNotation="1d6"
          fullScreen
          variant="button-only"
          showRollButton={false}
          themeColor={diceColor}
          rollSignal={explorationRerollSignal}
          onRollComplete={handleExplorationRerollComplete}
          onRollingChange={setIsExplorationRolling}
        />
      </PostbattleSection>

      <PostbattleSection
        id={getPostbattleSectionId("roster")}
        isMobile={isMobile}
        className={isMobile ? "battle-mobile-section-divider" : undefined}
      >
        <div>
          <p className="battle-section-title">{POSTBATTLE_SECTION_LABELS.roster}</p>
        </div>
        {currentRosterLoading ? <p className="text-sm text-muted-foreground">Loading roster...</p> : null}
        {currentRosterError ? <p className="text-sm text-red-600">{currentRosterError}</p> : null}
        {groups.map((group, index) => {
          const showSectionHeader =
            index === 0 || groups[index - 1]?.unitKind !== group.unitKind;

          if (group.unitKind === "henchman") {
            return (
              <div key={group.key} className="space-y-3">
                {showSectionHeader ? (
                  <p className="battle-section-title">Henchmen</p>
                ) : null}
                <div className="battle-inline-panel p-3">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div className="min-w-0 pb-2">
                        <p className="font-semibold text-foreground">{group.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.rows[0]?.unitType ?? "Henchmen"}
                        </p>
                      </div>
                      {group.rows[0] ? (
                        <label className="space-y-1">
                          <span className="block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                            XP
                          </span>
                          <PostbattleStepperInput
                            value={group.rows[0].xpEarned}
                            min={0}
                            disabled={isFinalized}
                            onCommit={(nextXp) => handleCommitGroupXp(group.label, nextXp)}
                          />
                        </label>
                      ) : null}
                    </div>
                    <div className="space-y-3 border-t border-border/40 pt-3">
                      {group.rows.map((row, index) => (
                        <div
                          key={row.unitKey}
                          className={index > 0 ? "border-t border-border/40 pt-3" : ""}
                        >
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <p className="font-semibold text-foreground">{row.unitName}</p>
                              {row.outOfAction ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="h-9"
                                  disabled={isFinalized}
                                  onClick={() =>
                                    setRollTarget({
                                      unitKey: row.unitKey,
                                      unitName: row.unitName,
                                      unitKind: row.unitKind,
                                    })
                                  }
                                >
                                  Serious Injury Roll
                                </Button>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-end justify-between gap-3">
                              <label className="space-y-1">
                                <span className="block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                                  Kills
                                </span>
                                <PostbattleStepperInput
                                  value={row.killCount}
                                  min={minimumUnitKillCounts[row.unitKey] ?? 0}
                                  disabled={isFinalized}
                                  onCommit={(nextKillCount) =>
                                    handleCommitUnitKillCount(row.unitKey, nextKillCount)
                                  }
                                />
                              </label>
                              <label className="flex h-9 items-center gap-2 text-sm text-foreground">
                                <Checkbox
                                  checked={row.dead}
                                  disabled={isFinalized}
                                  onChange={(event) => void handleToggleDead(row, event.target.checked)}
                                />
                                Dead
                              </label>
                            </div>
                            {row.seriousInjuryRolls.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {row.seriousInjuryRolls.map((roll, index) => (
                                  <div
                                    key={`${row.unitKey}-roll-${index}`}
                                    className="battle-chip px-3 py-1 text-xs text-muted-foreground"
                                  >
                                    {`${roll.roll_type.toUpperCase()} ${roll.result_code}: ${roll.result_label}`}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          const sectionLabel = group.unitKind === "hero" ? "Heroes" : "Hired Swords";

          return (
            <div key={group.key} className="space-y-3">
              {showSectionHeader ? (
                <p className="battle-section-title">{sectionLabel}</p>
              ) : null}
              {group.rows.map((row) => (
                <div
                  key={row.unitKey}
                  className={`battle-card p-3 ${
                    row.outOfAction ? "border-red-600/70" : "border-border/60"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{row.unitName}</p>
                        <p className="text-xs text-muted-foreground">{row.unitType}</p>
                      </div>
                      {row.outOfAction ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-9"
                          disabled={isFinalized}
                          onClick={() =>
                            setRollTarget({
                              unitKey: row.unitKey,
                              unitName: row.unitName,
                              unitKind: row.unitKind,
                            })
                          }
                        >
                          Serious Injury Roll
                        </Button>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div className="flex flex-wrap items-end gap-4">
                        <label className="space-y-1">
                          <span className="block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                            XP
                          </span>
                          <PostbattleStepperInput
                            value={row.xpEarned}
                            min={0}
                            disabled={isFinalized}
                            onCommit={(nextXp) => handleCommitUnitXp(row.unitKey, nextXp)}
                          />
                        </label>
                        <label className="space-y-1">
                          <span className="block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                            Kills
                          </span>
                          <PostbattleStepperInput
                            value={row.killCount}
                            min={minimumUnitKillCounts[row.unitKey] ?? 0}
                            disabled={isFinalized}
                            onCommit={(nextKillCount) =>
                              handleCommitUnitKillCount(row.unitKey, nextKillCount)
                            }
                          />
                        </label>
                      </div>
                      <label className="flex h-9 items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={row.dead}
                          disabled={isFinalized}
                          onChange={(event) => void handleToggleDead(row, event.target.checked)}
                        />
                        Dead
                      </label>
                    </div>
                  </div>
                  {row.seriousInjuryRolls.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.seriousInjuryRolls.map((roll, index) => (
                        <div
                          key={`${row.unitKey}-roll-${index}`}
                          className="battle-chip px-3 py-1 text-xs text-muted-foreground"
                        >
                          {`${roll.roll_type.toUpperCase()} ${roll.result_code}: ${roll.result_label}`}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </PostbattleSection>

      <PostbattleSection
        id={getPostbattleSectionId("finds")}
        isMobile={isMobile}
        className={cn(
          !isMobile && "battle-postbattle-finds-section",
          isMobile && "battle-mobile-section-divider"
        )}
      >
        <div>
          <p className="battle-section-title">{POSTBATTLE_SECTION_LABELS.finds}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Gold Crowns
            </span>
            <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3">
              <CommittedNumberInput
                value={draft?.finds.gold_crowns ?? 0}
                min={0}
                fallbackValue={0}
                className="field-surface h-10 !rounded-none"
                disabled={isFinalized}
                onCommit={handleCommitFindsGold}
              />
              <div className="battle-metric-box flex h-10 items-center justify-center px-3 text-sm font-semibold text-foreground">
                gc
              </div>
            </div>
          </label>
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Item Box
            </span>
            <div className="battle-inline-panel min-h-[8.5rem] space-y-3 p-3">
              <ActionSearchInput
                value={findItemSearch}
                onChange={(event) => {
                  setFindItemSearch(event.target.value);
                  if (!isFindItemDropdownOpen) {
                    setIsFindItemDropdownOpen(true);
                  }
                }}
                onFocus={() => setIsFindItemDropdownOpen(true)}
                placeholder="Search and add an item"
                disabled={isFinalized}
                containerClassName="battle-postbattle-finds-search w-full"
                inputClassName="field-surface h-10 !rounded-none !border-[#5a3f24] !bg-[#130d09] text-foreground placeholder:text-muted-foreground"
              >
                <ActionSearchDropdown
                  open={isFindItemDropdownOpen && !isFinalized}
                  onClose={() => setIsFindItemDropdownOpen(false)}
                  className="mt-1 !rounded-none border-[#5a3f24] bg-[#130d09]"
                >
                  <div className="max-h-60 w-full overflow-y-auto">
                    {isFindItemLoading ? (
                      <div className="px-3 py-3 text-sm text-muted-foreground">Searching items...</div>
                    ) : findItemSearchError ? (
                      <div className="px-3 py-3 text-sm text-red-600">{findItemSearchError}</div>
                    ) : findItemResults.length > 0 ? (
                      <div>
                        {findItemResults.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="flex w-full items-center justify-between gap-3 border-b border-border/40 px-3 py-2 text-left last:border-b-0 hover:bg-[#21170f]"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleAddFindItem(item)}
                          >
                            <span className="min-w-0 truncate font-semibold text-foreground">
                              {item.name}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {getItemAvailabilityCostLabel(item)}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-3 text-sm text-muted-foreground">
                        No matching items found.
                      </div>
                    )}
                  </div>
                </ActionSearchDropdown>
              </ActionSearchInput>
              {draft?.finds.items.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {draft.finds.items.map((item, index) => (
                    <div
                      key={`${item.item_id}-${index}`}
                      className="battle-card flex items-center justify-between gap-2 px-3 py-2"
                    >
                      <p className="min-w-0 truncate text-sm font-semibold text-foreground">{item.name}</p>
                      {!isFinalized ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 rounded-none"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => handleRemoveFindItem(index)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[5.5rem] items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  No found items added yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </PostbattleSection>

      {upkeepRows.length > 0 ? (
        <PostbattleSection
          id={getPostbattleSectionId("upkeep")}
          isMobile={isMobile}
          className={isMobile ? "battle-mobile-section-divider" : undefined}
        >
          <div>
            <p className="battle-section-title">{POSTBATTLE_SECTION_LABELS.upkeep}</p>
          </div>
          <div className="battle-inline-panel space-y-3 p-3">
            {upkeepRows.map((row, index) => (
              <div
                key={row.unitKey}
                className={`space-y-2 ${index > 0 ? "border-t border-border/40 pt-3" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{row.unitName}</p>
                    <p className="text-xs text-muted-foreground">{row.unitType}</p>
                  </div>
                  {row.hasFixedCost ? (
                    <label className="space-y-1">
                      <span className="block text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Upkeep
                      </span>
                      <PostbattleStepperInput
                        value={row.cost ?? 0}
                        min={0}
                        disabled={isFinalized || row.dead}
                        onCommit={(nextCost) => handleCommitUpkeepCost(row.unitKey, nextCost)}
                      />
                    </label>
                  ) : (
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                        Upkeep
                      </p>
                      <p className="text-sm text-foreground">
                        {row.costExpression || "No fixed upkeep cost"}
                      </p>
                    </div>
                  )}
                </div>
                {row.dead ? (
                  <p className="text-xs text-muted-foreground">
                    Excluded from upkeep total because this hired sword is marked dead.
                  </p>
                ) : null}
              </div>
            ))}
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border/40 pt-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  Total Cost
                </p>
                <div className="battle-metric-box mt-1 flex h-10 min-w-24 items-center px-3 text-sm font-semibold text-foreground">
                  {upkeepTotal} gc
                </div>
              </div>
              <label className="flex h-9 items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={Boolean(draft?.upkeep.pay_upkeep)}
                  disabled={isFinalized}
                  onChange={(event) => handleTogglePayUpkeep(event.target.checked)}
                />
                Pay upkeep
              </label>
            </div>
          </div>
        </PostbattleSection>
      ) : null}

      {!isMobile ? (
        <div className="fixed inset-x-0 bottom-4 z-20 px-3 min-[960px]:left-auto min-[960px]:right-4 min-[960px]:inset-x-auto min-[960px]:w-[520px]">
          <CardBackground className="battle-floating-panel space-y-2 p-3">
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="destructive"
                disabled={isFinalized || isFinalizing || isLeaving || isSavingDraft}
                onClick={() => setIsLeaveConfirmOpen(true)}
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

      <SeriousInjuryRollDialog
        target={rollTarget}
        heroRollType={heroDeathRoll}
        themeColor={diceColor}
        open={Boolean(rollTarget)}
        disabled={isFinalized || isSavingDraft || isSeriousInjuryRolling}
        onOpenChange={(open) => !open && setRollTarget(null)}
        onRollComplete={(results) => void handleRollSeriousInjury(results)}
        onRollingChange={setIsSeriousInjuryRolling}
      />
      <Dialog open={isFinalizeModalOpen} onOpenChange={setIsFinalizeModalOpen}>
        <DialogContent className={`max-w-2xl ${HELPER_DIALOG_CONTENT_CLASS}`}>
          <DialogHeader>
            <DialogTitle>Finalise Postbattle</DialogTitle>
            <DialogDescription>
              Review the permanent changes that will be applied to {currentParticipant.warband.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="battle-inline-panel p-4">
              <p className="battle-section-title">{POSTBATTLE_SECTION_LABELS.exploration}</p>
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
            <div className="battle-inline-panel p-4">
              <p className="battle-section-title">{POSTBATTLE_SECTION_LABELS.finds}</p>
              <div className="mt-2 space-y-2">
                {finalizeSummary.findsGoldCrowns > 0 ? (
                  <p className="text-sm text-foreground">
                    {finalizeSummary.findsGoldCrowns} gc will be added as a Reward trade.
                  </p>
                ) : null}
                {finalizeSummary.findsItems.length > 0 ? (
                  <div className="space-y-2">
                    {finalizeSummary.findsItems.map((item, index) => (
                      <p key={`${item.item_id}-${index}`} className="text-sm text-foreground">
                        {item.name} will be added to the stash
                        {item.cost !== null ? ` at ${item.cost} gc` : ""}.
                      </p>
                    ))}
                  </div>
                ) : null}
                {finalizeSummary.findsGoldCrowns <= 0 && finalizeSummary.findsItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No finds are currently set.</p>
                ) : null}
              </div>
            </div>
            <div className="battle-inline-panel p-4">
              <p className="battle-section-title">Deaths</p>
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
            <div className="battle-inline-panel p-4">
              <p className="battle-section-title">XP Awards</p>
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
            {upkeepRows.length > 0 ? (
              <div className="battle-inline-panel p-4">
                <p className="battle-section-title">{POSTBATTLE_SECTION_LABELS.upkeep}</p>
                {finalizeSummary.payUpkeep ? (
                  <p className="mt-2 text-sm text-foreground">
                    You will be paying {finalizeSummary.upkeepTotal}gc in upkeep.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pay upkeep is unchecked, so no Upkeep trade entry will be created.
                  </p>
                )}
              </div>
            ) : null}
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
              {isFinalizing ? "Finalising..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isLeaveConfirmOpen} onOpenChange={setIsLeaveConfirmOpen}>
        <DialogContent className={`max-w-lg ${HELPER_DIALOG_CONTENT_CLASS}`}>
          <DialogHeader>
            <DialogTitle>Leave Battle</DialogTitle>
            <DialogDescription>
              Leave this battle? You will not be able to rejoin, and changes from this page will not be applied.
            </DialogDescription>
          </DialogHeader>
          {draftError ? <p className="text-sm text-red-600">{draftError}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsLeaveConfirmOpen(false)}
              disabled={isLeaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleLeaveWithoutSaving()}
              disabled={isLeaving}
            >
              {isLeaving ? "Leaving..." : "Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


