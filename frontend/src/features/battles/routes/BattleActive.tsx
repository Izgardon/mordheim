import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { BookOpen } from "lucide-react";

import { CardBackground } from "@/components/ui/card-background";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingScreen } from "@/components/ui/loading-screen";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import {
  appendBattleEvent,
  cancelBattleAsCreator,
  finishBattle,
  getBattleState,
  recordUnitKill,
  saveBattleParticipantConfig,
  setUnitOutOfAction,
} from "@/features/battles/api/battles-api";
import ActiveParticipantRoster from "@/features/battles/components/active/ActiveParticipantRoster";
import ActiveCriticalHitDialog from "@/features/battles/components/active/ActiveCriticalHitDialog";
import ActiveMeleeDialog, {
  type ActiveMeleeUnitOption,
} from "@/features/battles/components/active/ActiveMeleeDialog";
import ActiveRangedDialog, {
  type ActiveRangedUnitOption,
} from "@/features/battles/components/active/ActiveRangedDialog";
import PrebattleCustomUnitBuilder from "@/features/battles/components/prebattle/PrebattleCustomUnitBuilder";
import {
  DEFAULT_CUSTOM_UNIT_DRAFT,
  type CustomUnitDraft,
  type PrebattleUnit,
  type StatKey,
  type UnitOverride,
  type UnitSingleUseItem,
} from "@/features/battles/components/prebattle/prebattle-types";
import {
  buildBattleUnitOptions,
  getCurrentUnitWounds,
  getParticipantSelectedUnits,
  setUnitCurrentWounds,
  setUnitOverrideStat,
  toUnitInformationMap,
  updateUnitInformationOverride,
} from "@/features/battles/components/active/active-utils";
import {
  useBattleMobileBottomBar,
  useBattleMobileTopBar,
} from "@/features/battles/components/shared/useBattleMobileBars";
import { usePrebattleRosters } from "@/features/battles/components/prebattle/usePrebattleRosters";
import {
  serializeCustomUnits,
  toArmourSaveStat,
  toNumericStat,
  normalizeCustomUnits,
  toUnitRating,
} from "@/features/battles/components/prebattle/prebattle-utils";
import type { BattleState } from "@/features/battles/types/battle-types";
import type { BattleLayoutContext } from "@/features/battles/routes/BattleLayout";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { createBattleSessionSocket } from "@/lib/realtime";
import { useMediaQuery } from "@/lib/use-media-query";
import WarbandPdfViewerDialog from "@/features/warbands/components/warband/WarbandPdfViewerDialog";

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
  const [selectedWinnerWarbandIds, setSelectedWinnerWarbandIds] = useState<number[]>([]);

  const [isCancelBattleDialogOpen, setIsCancelBattleDialogOpen] = useState(false);
  const [isCancelingBattle, setIsCancelingBattle] = useState(false);
  const [cancelBattleError, setCancelBattleError] = useState("");
  const [cancelBattleConfirmed, setCancelBattleConfirmed] = useState(false);
  const [isScenarioLinkDialogOpen, setIsScenarioLinkDialogOpen] = useState(false);
  const [showAddCustomUnit, setShowAddCustomUnit] = useState(false);
  const [customUnitDraft, setCustomUnitDraft] = useState<CustomUnitDraft>({
    ...DEFAULT_CUSTOM_UNIT_DRAFT,
  });
  const [customUnitFormError, setCustomUnitFormError] = useState("");
  const [isMeleeDialogOpen, setIsMeleeDialogOpen] = useState(false);
  const [isRangedDialogOpen, setIsRangedDialogOpen] = useState(false);
  const [isCriticalHitDialogOpen, setIsCriticalHitDialogOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [savingUnitKeys, setSavingUnitKeys] = useState<Record<string, boolean>>({});
  const [activeItemActionKey, setActiveItemActionKey] = useState<string | null>(null);

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

  const saveCurrentParticipantConfig = useCallback(
    async ({
      unitInformation,
      selectedUnitKeys,
      customUnits,
      savingUnitKey,
    }: {
      unitInformation?: ReturnType<typeof toUnitInformationMap>;
      selectedUnitKeys?: string[];
      customUnits?: ReturnType<typeof serializeCustomUnits>;
      savingUnitKey?: string;
    }) => {
      if (!currentParticipant) {
        return null;
      }

      const nextUnitInformation =
        unitInformation ?? toUnitInformationMap(currentParticipant.unit_information_json);
      const nextSelectedUnitKeys = selectedUnitKeys ?? (currentParticipant.selected_unit_keys_json ?? []);
      const nextCustomUnits = customUnits ?? (currentParticipant.custom_units_json ?? []);

      if (savingUnitKey) {
        setSavingUnitKeys((prev) => ({ ...prev, [savingUnitKey]: true }));
      }
      setIsSavingConfig(true);
      setActionError("");
      try {
        const next = await saveBattleParticipantConfig(campaignId, numericBattleId, {
          selected_unit_keys_json: nextSelectedUnitKeys,
          unit_information_json: nextUnitInformation,
          custom_units_json: nextCustomUnits,
        });
        setBattleState(next);
        return next;
      } catch (errorResponse) {
        if (errorResponse instanceof Error) {
          setActionError(errorResponse.message || "Unable to save unit config");
        } else {
          setActionError("Unable to save unit config");
        }
        throw errorResponse;
      } finally {
        if (savingUnitKey) {
          setSavingUnitKeys((prev) => {
            const next = { ...prev };
            delete next[savingUnitKey];
            return next;
          });
        }
        setIsSavingConfig(false);
      }
    },
    [campaignId, currentParticipant, numericBattleId]
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
    () =>
      buildBattleUnitOptions(battleState?.participants ?? [], rosters).filter(
        (option) => option.participantUserId !== currentParticipant?.user.id
      ),
    [battleState?.participants, currentParticipant?.user.id, rosters]
  );
  const usedSingleUseItemCounts = useMemo(() => {
    const counts: Record<string, Record<number, number>> = {};
    for (const event of battleState?.events ?? []) {
      if (event.type !== "item_used") {
        continue;
      }
      const payload = event.payload_json;
      if (!payload || typeof payload !== "object") {
        continue;
      }
      const unitKeyRaw = (payload as { unit_key?: unknown }).unit_key;
      const itemIdRaw = (payload as { item_id?: unknown }).item_id;
      if (typeof unitKeyRaw !== "string" || !unitKeyRaw.trim()) {
        continue;
      }
      const itemId = Number(itemIdRaw);
      if (!Number.isFinite(itemId) || itemId <= 0) {
        continue;
      }
      const unitKey = unitKeyRaw.trim();
      if (!counts[unitKey]) {
        counts[unitKey] = {};
      }
      counts[unitKey][itemId] = (counts[unitKey][itemId] ?? 0) + 1;
    }
    return counts;
  }, [battleState?.events]);
  const getUsedSingleUseItemCount = useCallback(
    (unitKey: string, itemId: number) => usedSingleUseItemCounts[unitKey]?.[itemId] ?? 0,
    [usedSingleUseItemCounts]
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

  const meleeUnitOptions = useMemo(() => {
    const options: { yours: ActiveMeleeUnitOption[]; others: ActiveMeleeUnitOption[] } = {
      yours: [],
      others: [],
    };
    const currentUserId = currentParticipant?.user.id;
    if (!currentUserId) {
      return options;
    }

    for (const participant of battleState?.participants ?? []) {
      const participantRoster = rosters[participant.user.id];
      const selectedUnits = getParticipantSelectedUnits(participant, participantRoster);
      const unitInformation = toUnitInformationMap(participant.unit_information_json);
      const units = [
        ...selectedUnits.heroes,
        ...selectedUnits.henchmen,
        ...selectedUnits.hiredSwords,
        ...selectedUnits.temporary,
      ];

      for (const unit of units) {
        const entry = unitInformation[unit.key];
        if (entry?.out_of_action) {
          continue;
        }
        const mergedStats = {
          ...unit.stats,
          ...(entry?.stats_override ?? {}),
        };
        const option: ActiveMeleeUnitOption = {
          value: `${participant.user.id}:${unit.key}`,
          label: `${unit.displayName} (${participant.warband.name})`,
          stats: mergedStats,
          defaultWeaponSkill: Number(mergedStats.weapon_skill ?? 1),
        };
        if (participant.user.id === currentUserId) {
          options.yours.push(option);
        } else {
          options.others.push(option);
        }
      }
    }

    options.yours.sort((left, right) => left.label.localeCompare(right.label));
    options.others.sort((left, right) => left.label.localeCompare(right.label));
    return options;
  }, [battleState?.participants, currentParticipant?.user.id, rosters]);
  const rangedUnitOptions = useMemo(() => {
    const options: ActiveRangedUnitOption[] = [];
    if (!currentParticipant) {
      return options;
    }

    const participantRoster = rosters[currentParticipant.user.id];
    const selectedUnits = getParticipantSelectedUnits(currentParticipant, participantRoster);
    const unitInformation = toUnitInformationMap(currentParticipant.unit_information_json);
    const units = [
      ...selectedUnits.heroes,
      ...selectedUnits.henchmen,
      ...selectedUnits.hiredSwords,
      ...selectedUnits.temporary,
    ];

    for (const unit of units) {
      const entry = unitInformation[unit.key];
      if (entry?.out_of_action) {
        continue;
      }
      const mergedStats = {
        ...unit.stats,
        ...(entry?.stats_override ?? {}),
      };
      options.push({
        value: unit.key,
        label: unit.displayName,
        stats: mergedStats,
        defaultBallisticSkill: Number(mergedStats.ballistic_skill ?? 1),
      });
    }

    options.sort((left, right) => left.label.localeCompare(right.label));
    return options;
  }, [currentParticipant, rosters]);

  const isBattleCreator = useMemo(
    () => battleState?.battle.created_by_user_id === user?.id,
    [battleState?.battle.created_by_user_id, user?.id]
  );
  const showScenarioLinkAction = Boolean(battleState?.battle.scenario_link);

  const mobileTopBarExtraActions = useMemo(
    () =>
      showScenarioLinkAction ? (
        <button
          type="button"
          onClick={() => setIsScenarioLinkDialogOpen(true)}
          className="icon-button mr-1 flex h-9 w-9 items-center justify-center border-none bg-transparent p-0"
          aria-label="View scenario link"
        >
          <BookOpen className="theme-heading-soft h-5 w-5" aria-hidden="true" />
        </button>
      ) : null,
    [showScenarioLinkAction]
  );

  const { sectionIdByKey } = useBattleMobileTopBar({
    isMobile,
    setBattleMobileTopBar,
    title: "In Battle",
    onBack: () => setIsLeaveDialogOpen(true),
    extraActions: mobileTopBarExtraActions,
    statusParticipants,
    selectedParticipant,
    selectedParticipantRoster: selectedParticipant
      ? rosters[selectedParticipant.user.id]
      : undefined,
    selectedParticipantCustomUnits,
    onSelectParticipantUserId: setSelectedParticipantUserId,
  });

  const activeBottomBarConfig = useMemo(
    () =>
      battleState?.battle.status === "active" && isBattleCreator
        ? {
            primaryAction: {
              label: isCancelingBattle ? "Canceling..." : "Cancel battle",
              onClick: () => setIsCancelBattleDialogOpen(true),
              disabled: isCancelingBattle,
              variant: "secondary" as const,
            },
            secondaryAction: {
              label: isFinishingBattle ? "Ending..." : "End Battle",
              onClick: () => setIsFinishDialogOpen(true),
              disabled: isFinishingBattle,
              variant: "destructive" as const,
            },
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
    if (selectedWinnerWarbandIds.length === 0) {
      setFinishError("Select at least one winning warband.");
      return;
    }
    setIsFinishingBattle(true);
    setFinishError("");
    try {
      const next = await finishBattle(campaignId, numericBattleId, {
        winner_warband_ids: selectedWinnerWarbandIds,
      });
      setBattleState(next);
      setIsFinishDialogOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFinishError(errorResponse.message || "Unable to end battle");
      } else {
        setFinishError("Unable to end battle");
      }
    } finally {
      setIsFinishingBattle(false);
    }
  }, [campaignId, numericBattleId, selectedWinnerWarbandIds]);

  useEffect(() => {
    if (!isFinishDialogOpen) {
      return;
    }
    setFinishError("");
    setSelectedWinnerWarbandIds([]);
  }, [isFinishDialogOpen]);

  useEffect(() => {
    if (!isCancelBattleDialogOpen) {
      setCancelBattleConfirmed(false);
    }
  }, [isCancelBattleDialogOpen]);

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

  const handleAdjustUnitWounds = useCallback(
    async (unit: PrebattleUnit, delta: number) => {
      if (!currentParticipant || delta === 0) {
        return;
      }

      const unitInformation = toUnitInformationMap(currentParticipant.unit_information_json);
      const currentWounds = getCurrentUnitWounds(unit, unitInformation[unit.key]);
      const nextWounds = Math.max(0, Math.min(10, currentWounds + delta));
      if (nextWounds === currentWounds) {
        return;
      }

      const nextUnitInformation =
        unit.kind === "henchman"
          ? setUnitCurrentWounds(unitInformation, unit, nextWounds)
          : setUnitOverrideStat(unitInformation, unit, "wounds", nextWounds);
      await saveCurrentParticipantConfig({
        unitInformation: nextUnitInformation,
        savingUnitKey: unit.key,
      });
    },
    [currentParticipant, saveCurrentParticipantConfig]
  );

  const handleSaveUnitOverride = useCallback(
    async (unitKey: string, override: UnitOverride | undefined) => {
      if (!currentParticipant) {
        return;
      }

      const participantRoster = rosters[currentParticipant.user.id];
      const selectedUnits = getParticipantSelectedUnits(currentParticipant, participantRoster);
      const unit = [
        ...selectedUnits.heroes,
        ...selectedUnits.henchmen,
        ...selectedUnits.hiredSwords,
        ...selectedUnits.temporary,
      ].find((entry) => entry.key === unitKey);

      if (!unit) {
        throw new Error("Unable to find unit for active edit");
      }

      const unitInformation = toUnitInformationMap(currentParticipant.unit_information_json);
      const nextUnitInformation = updateUnitInformationOverride(unitInformation, unit, override);
      await saveCurrentParticipantConfig({
        unitInformation: nextUnitInformation,
        savingUnitKey: unitKey,
      });
    },
    [currentParticipant, rosters, saveCurrentParticipantConfig]
  );

  const handleRecordUnitKill = useCallback(
    async (payload: {
      killerUnitKey: string;
      victimUnitKey?: string;
      victimName?: string;
      notes?: string;
      earnedXp: boolean;
    }) => {
      const next = await recordUnitKill(campaignId, numericBattleId, {
        killer_unit_key: payload.killerUnitKey,
        victim_unit_key: payload.victimUnitKey,
        victim_name: payload.victimName,
        notes: payload.notes,
        earned_xp: payload.earnedXp,
      });
      setBattleState(next);
    },
    [campaignId, numericBattleId]
  );
  const handleUseSingleUseItem = useCallback(
    async (unit: PrebattleUnit, item: UnitSingleUseItem) => {
      if (!battleState || !currentParticipant) {
        return;
      }
      const actionKey = `${unit.key}:${item.id}`;
      setActiveItemActionKey(actionKey);
      setActionError("");
      try {
        const next = await appendBattleEvent(campaignId, numericBattleId, {
          type: "item_used",
          payload_json: {
            participant_user_id: currentParticipant.user.id,
            unit_key: unit.key,
            unit_id: typeof unit.id === "number" ? unit.id : null,
            unit_type: unit.kind,
            item_id: item.id,
            item_name: item.name,
          },
        });
        setBattleState(next);
      } catch (errorResponse) {
        if (errorResponse instanceof Error) {
          setActionError(errorResponse.message || "Unable to log item use");
        } else {
          setActionError("Unable to log item use");
        }
      } finally {
        setActiveItemActionKey((prev) => (prev === actionKey ? null : prev));
      }
    },
    [battleState, campaignId, currentParticipant, numericBattleId]
  );

  const updateCustomDraftStat = (key: StatKey, value: string) => {
    setCustomUnitDraft((prev) => {
      if (key === "armour_save") {
        const normalized = value.replace(/[^\d-]/g, "");
        const hasLeadingMinus = normalized.startsWith("-");
        const digits = normalized.replace(/-/g, "");
        const nextValue = hasLeadingMinus
          ? `-${digits.slice(0, 2)}`
          : digits.slice(0, 2);
        return {
          ...prev,
          stats: {
            ...prev.stats,
            armour_save: nextValue,
          },
        };
      }
      return {
        ...prev,
        stats: {
          ...prev.stats,
          [key]: value.replace(/[^\d]/g, "").slice(0, 2),
        },
      };
    });
  };

  const makeCustomUnitKey = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `custom:${crypto.randomUUID()}`;
    }
    return `custom:${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  };

  const handleAddCustomUnit = useCallback(async () => {
    if (!currentParticipant) {
      return;
    }

    const name = customUnitDraft.name.trim();
    const unitType = customUnitDraft.unitType.trim();
    const reason = customUnitDraft.reason.trim();
    if (!name || !unitType) {
      setCustomUnitFormError("Temporary units need a name and unit type.");
      return;
    }
    if (!reason) {
      setCustomUnitFormError("Temporary units need a reason.");
      return;
    }

    const customUnitKey = makeCustomUnitKey();
    const unit: PrebattleUnit = {
      key: customUnitKey,
      id: customUnitKey,
      kind: "custom",
      displayName: name,
      unitType,
      rating: toUnitRating(customUnitDraft.rating),
      stats: {
        movement: toNumericStat(customUnitDraft.stats.movement),
        weapon_skill: toNumericStat(customUnitDraft.stats.weapon_skill),
        ballistic_skill: toNumericStat(customUnitDraft.stats.ballistic_skill),
        strength: toNumericStat(customUnitDraft.stats.strength),
        toughness: toNumericStat(customUnitDraft.stats.toughness),
        wounds: toNumericStat(customUnitDraft.stats.wounds),
        initiative: toNumericStat(customUnitDraft.stats.initiative),
        attacks: toNumericStat(customUnitDraft.stats.attacks),
        leadership: toNumericStat(customUnitDraft.stats.leadership),
        armour_save: toArmourSaveStat(customUnitDraft.stats.armour_save),
      },
      customReason: reason,
    };

    const existingCustomUnits = normalizeCustomUnits(currentParticipant.custom_units_json);
    const nextCustomUnits = [...existingCustomUnits, unit];
    const nextSelectedUnitKeys = Array.from(
      new Set([...(currentParticipant.selected_unit_keys_json ?? []), unit.key])
    );

    try {
      const next = await saveCurrentParticipantConfig({
        selectedUnitKeys: nextSelectedUnitKeys,
        unitInformation: toUnitInformationMap(currentParticipant.unit_information_json),
        customUnits: serializeCustomUnits(nextCustomUnits),
      });
      if (!next) {
        return;
      }
      setCustomUnitDraft({ ...DEFAULT_CUSTOM_UNIT_DRAFT });
      setCustomUnitFormError("");
      setShowAddCustomUnit(false);
    } catch {
      return;
    }
  }, [currentParticipant, customUnitDraft, saveCurrentParticipantConfig]);

  if (isLoading) {
    return <LoadingScreen message="Loading battle..." />;
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

  const participantIds = battleState.participants.map((participant) => participant.user.id);
  const hasRosterResultForAllParticipants = participantIds.every(
    (participantUserId) => Boolean(rosters[participantUserId] || rosterErrors[participantUserId])
  );
  const hasPendingRosterRequests = participantIds.some(
    (participantUserId) => Boolean(rosterLoading[participantUserId])
  );
  if (participantIds.length > 0 && (!hasRosterResultForAllParticipants || hasPendingRosterRequests || !selectedParticipant)) {
    return <LoadingScreen message="Loading battle..." />;
  }

  const selectedParticipantRoster = selectedParticipant
    ? rosters[selectedParticipant.user.id]
    : undefined;
  const isSelectedRosterLoading = Boolean(
    selectedParticipant &&
      rosterLoading[selectedParticipant.user.id] &&
      !rosters[selectedParticipant.user.id]
  );
  const canInteractWithSelectedParticipant = Boolean(
    selectedParticipant &&
      selectedParticipant.user.id === user?.id &&
      selectedParticipant.status === "in_battle"
  );
  const selectedParticipantIsCurrentUser = Boolean(
    selectedParticipant && currentParticipant && selectedParticipant.user.id === currentParticipant.user.id
  );

  return (
    <div className="battle-page battle-active-page min-h-0 space-y-4 px-2 pb-24 sm:px-0">
      {!isMobile ? (
        <PageHeader
          title="Battle"
          subtitle={`Session #${battleId ?? "-"}${battleState.battle.scenario ? ` - ${battleState.battle.scenario}` : ""}`}
        />
      ) : null}

      {isSelectedRosterLoading ? (
        <CardBackground className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Loading units...</p>
        </CardBackground>
      ) : selectedParticipant ? (
        <ActiveParticipantRoster
          participant={selectedParticipant}
          onOpenMelee={() => setIsMeleeDialogOpen(true)}
          onOpenRanged={() => setIsRangedDialogOpen(true)}
          onOpenCriticalHits={() => setIsCriticalHitDialogOpen(true)}
          meleeDisabled={meleeUnitOptions.yours.length === 0 || meleeUnitOptions.others.length === 0}
          rangedDisabled={rangedUnitOptions.length === 0}
          participantRoster={selectedParticipantRoster}
          rosterLoading={Boolean(rosterLoading[selectedParticipant.user.id])}
          rosterError={rosterErrors[selectedParticipant.user.id]}
          unitInformationByKey={selectedParticipantUnitInformation}
          killTargetOptions={killTargetOptions}
          canInteract={canInteractWithSelectedParticipant}
          onSetOutOfAction={handleSetUnitOutOfAction}
          onAdjustWounds={handleAdjustUnitWounds}
          onSaveOverride={handleSaveUnitOverride}
          onRecordKill={handleRecordUnitKill}
          onUseSingleUseItem={handleUseSingleUseItem}
          getUsedSingleUseItemCount={getUsedSingleUseItemCount}
          activeItemActionKey={activeItemActionKey}
          savingUnitKeys={savingUnitKeys}
          sectionIds={sectionIdByKey}
        />
      ) : (
        <CardBackground className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">No warbands available yet.</p>
        </CardBackground>
      )}

      {selectedParticipantIsCurrentUser && canInteractWithSelectedParticipant ? (
        <>
          {isSavingConfig ? (
            <p className="text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground">
              Saving unit config...
            </p>
          ) : null}
          {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
          <PrebattleCustomUnitBuilder
            open={showAddCustomUnit}
            draft={customUnitDraft}
            error={customUnitFormError}
            showRatingField={false}
            campaignId={campaignId}
            onToggleOpen={() => {
              setShowAddCustomUnit((prev) => !prev);
              setCustomUnitFormError("");
            }}
            onDraftChange={(next) => {
              setCustomUnitDraft(next);
              if (customUnitFormError) {
                setCustomUnitFormError("");
              }
            }}
            onDraftStatChange={updateCustomDraftStat}
            onSave={() => void handleAddCustomUnit()}
          />
        </>
      ) : null}

      {!isMobile && activeBottomBarConfig ? (
        <div className="fixed inset-x-0 bottom-4 z-20 px-3 min-[960px]:left-auto min-[960px]:right-4 min-[960px]:inset-x-auto min-[960px]:w-[520px]">
          <CardBackground className="battle-floating-panel space-y-2 p-3">
            <div className="flex flex-wrap justify-end gap-2">
              {activeBottomBarConfig.primaryAction ? (
                <Button
                  variant={activeBottomBarConfig.primaryAction.variant ?? "secondary"}
                  onClick={activeBottomBarConfig.primaryAction.onClick}
                  disabled={activeBottomBarConfig.primaryAction.disabled}
                >
                  {activeBottomBarConfig.primaryAction.label}
                </Button>
              ) : null}
              {activeBottomBarConfig.secondaryAction ? (
                <Button
                  variant={activeBottomBarConfig.secondaryAction.variant ?? "default"}
                  onClick={activeBottomBarConfig.secondaryAction.onClick}
                  disabled={activeBottomBarConfig.secondaryAction.disabled}
                >
                  {activeBottomBarConfig.secondaryAction.label}
                </Button>
              ) : null}
            </div>
          </CardBackground>
        </div>
      ) : null}

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
      {battleState.battle.scenario_link ? (
        <WarbandPdfViewerDialog
          open={isScenarioLinkDialogOpen}
          onOpenChange={setIsScenarioLinkDialogOpen}
          url={battleState.battle.scenario_link}
          title={battleState.battle.scenario || "Scenario"}
        />
      ) : null}

      <Dialog open={isFinishDialogOpen} onOpenChange={setIsFinishDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>End Active Battle</DialogTitle>
            <DialogDescription>
              Declare which warband or warbands won this battle, then move everyone into postbattle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select the winners of this battle.
            </p>
            {(battleState?.participants ?? []).map((participant) => {
              const checked = selectedWinnerWarbandIds.includes(participant.warband.id);
              return (
                <label
                  key={`winner-${participant.id}`}
                  className="battle-inline-panel flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground"
                >
                  <Checkbox
                    checked={checked}
                    onChange={(event) => {
                      const isChecked = event.target.checked;
                      setSelectedWinnerWarbandIds((current) => {
                        if (isChecked) {
                          return current.includes(participant.warband.id)
                            ? current
                            : [...current, participant.warband.id];
                        }
                        return current.filter((entry) => entry !== participant.warband.id);
                      });
                    }}
                  />
                  <span>{participant.warband.name}</span>
                </label>
              );
            })}
            {finishError ? <p className="text-sm text-red-600">{finishError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsFinishDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleFinishBattle()}
              disabled={isFinishingBattle || selectedWinnerWarbandIds.length === 0}
            >
              {isFinishingBattle ? "Ending..." : "End battle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCancelBattleDialogOpen}
        onOpenChange={setIsCancelBattleDialogOpen}
      >
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Cancel Battle</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p>Cancel this battle for all participants?</p>
            <label className="battle-inline-panel mt-3 flex items-start gap-3 rounded-xl px-3 py-2 text-sm text-foreground">
              <Checkbox
                checked={cancelBattleConfirmed}
                disabled={isCancelingBattle}
                onChange={(event) => setCancelBattleConfirmed(event.target.checked)}
                className="mt-0.5"
              />
              <span>I understand this will cancel the battle for all participants.</span>
            </label>
            {cancelBattleError ? <p className="text-sm text-red-600">{cancelBattleError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCancelBattleDialogOpen(false)}
              disabled={isCancelingBattle}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleCancelBattle()}
              disabled={isCancelingBattle || !cancelBattleConfirmed}
            >
              {isCancelingBattle ? "Canceling..." : "Cancel battle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ActiveMeleeDialog
        open={isMeleeDialogOpen}
        onOpenChange={setIsMeleeDialogOpen}
        yourUnitOptions={meleeUnitOptions.yours}
        enemyUnitOptions={meleeUnitOptions.others}
      />
      <ActiveRangedDialog
        open={isRangedDialogOpen}
        onOpenChange={setIsRangedDialogOpen}
        yourUnitOptions={rangedUnitOptions}
      />
      <ActiveCriticalHitDialog
        open={isCriticalHitDialogOpen}
        onOpenChange={setIsCriticalHitDialogOpen}
      />
    </div>
  );
}
