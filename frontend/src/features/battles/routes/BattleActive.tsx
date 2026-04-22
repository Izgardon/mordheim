import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { BookOpen, PenLine } from "lucide-react";

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
import {
  appendBattleEvent,
  cancelBattleAsCreator,
  finishBattle,
  recordUnitKill,
  saveBattleParticipantConfig,
  setUnitOutOfAction,
} from "@/features/battles/api/battles-api";
import ActiveBattleHelpers from "@/features/battles/components/active/ActiveBattleHelpers";
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
  toUnitInformationMap,
  updateUnitInformationOverride,
  updateUnitInformationNotes,
} from "@/features/battles/components/active/active-utils";
import {
  useBattleMobileBottomBar,
  useBattleMobileTopBar,
} from "@/features/battles/components/shared/useBattleMobileBars";
import BattleDesktopSubnav from "@/features/battles/components/shared/BattleDesktopSubnav";
import BattleNotesDialog from "@/features/battles/components/shared/BattleNotesDialog";
import { useBattleRosters } from "@/features/battles/hooks/useBattleRosters";
import { useBattleState } from "@/features/battles/hooks/useBattleState";
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

  const {
    battleState,
    battleStateRef,
    isLoading,
    error,
    applyBattleResponse,
    updateBattleState,
  } = useBattleState({
    campaignId,
    battleId: numericBattleId,
    view: "active",
    currentUserId: user?.id,
  });
  const { rosters, rosterLoading, rosterErrors } = useBattleRosters(
    campaignId,
    numericBattleId,
    battleState?.participants
  );
  const [selectedParticipantUserId, setSelectedParticipantUserId] = useState<number | null>(null);

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
  const [isBattleNotesOpen, setIsBattleNotesOpen] = useState(false);
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
  const queuedConfigRef = useRef<{
    payload: {
      selected_unit_keys_json: string[];
      unit_information_json: Record<string, unknown>;
      custom_units_json: ReturnType<typeof serializeCustomUnits>;
      battle_notes: string;
    };
    savingUnitKey?: string;
    showGlobalSaving: boolean;
    resolve: (value: BattleState | null) => void;
    reject: (reason?: unknown) => void;
  } | null>(null);
  const isFlushingConfigRef = useRef(false);

  const currentParticipant = useMemo(
    () => battleState?.participants.find((participant) => participant.user.id === user?.id) ?? null,
    [battleState?.participants, user?.id]
  );

  const getCurrentParticipantSnapshot = useCallback(() => {
    const state = battleStateRef.current;
    if (!state) {
      return null;
    }
    return state.participants.find((participant) => participant.user.id === user?.id) ?? null;
  }, [battleStateRef, user?.id]);

  const applyLocalCurrentParticipantConfig = useCallback(
    (payload: {
      selected_unit_keys_json: string[];
      unit_information_json: Record<string, unknown>;
      custom_units_json: ReturnType<typeof serializeCustomUnits>;
      battle_notes: string;
    }) => {
      updateBattleState((previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          participants: previous.participants.map((participant) =>
            participant.user.id === user?.id
              ? {
                  ...participant,
                  selected_unit_keys_json: payload.selected_unit_keys_json,
                  unit_information_json: payload.unit_information_json as typeof participant.unit_information_json,
                  custom_units_json: payload.custom_units_json,
                  battle_notes: payload.battle_notes,
                }
              : participant
          ),
        };
      });
    },
    [updateBattleState, user?.id]
  );

  const flushQueuedConfig = useCallback(async () => {
    if (isFlushingConfigRef.current) {
      return;
    }
    isFlushingConfigRef.current = true;

    while (queuedConfigRef.current) {
      const nextRequest = queuedConfigRef.current;
      queuedConfigRef.current = null;

      if (nextRequest.savingUnitKey) {
        setSavingUnitKeys((previous) => ({ ...previous, [nextRequest.savingUnitKey as string]: true }));
      }
      if (nextRequest.showGlobalSaving) {
        setIsSavingConfig(true);
        setActionError("");
      }

      try {
        const next = await saveBattleParticipantConfig(campaignId, numericBattleId, nextRequest.payload);
        applyBattleResponse(next);
        nextRequest.resolve(next);
      } catch (errorResponse) {
        if (nextRequest.showGlobalSaving) {
          if (errorResponse instanceof Error) {
            setActionError(errorResponse.message || "Unable to save unit config");
          } else {
            setActionError("Unable to save unit config");
          }
        }
        nextRequest.reject(errorResponse);
      } finally {
        if (nextRequest.savingUnitKey) {
          setSavingUnitKeys((previous) => {
            const next = { ...previous };
            delete next[nextRequest.savingUnitKey as string];
            return next;
          });
        }
        if (nextRequest.showGlobalSaving) {
          setIsSavingConfig(false);
        }
      }
    }

    isFlushingConfigRef.current = false;
  }, [applyBattleResponse, campaignId, numericBattleId]);

  const saveCurrentParticipantConfig = useCallback(
    async ({
      unitInformation,
      selectedUnitKeys,
      customUnits,
      battleNotes,
      savingUnitKey,
      showGlobalSaving = true,
    }: {
      unitInformation?: ReturnType<typeof toUnitInformationMap>;
      selectedUnitKeys?: string[];
      customUnits?: ReturnType<typeof serializeCustomUnits>;
      battleNotes?: string;
      savingUnitKey?: string;
      showGlobalSaving?: boolean;
    }) => {
      const participant = getCurrentParticipantSnapshot();
      if (!participant) {
        return null;
      }

      const payload = {
        selected_unit_keys_json: selectedUnitKeys ?? (participant.selected_unit_keys_json ?? []),
        unit_information_json:
          unitInformation ?? toUnitInformationMap(participant.unit_information_json),
        custom_units_json: customUnits ?? (participant.custom_units_json ?? []),
        battle_notes: battleNotes ?? (participant.battle_notes ?? ""),
      };

      applyLocalCurrentParticipantConfig(payload);

      return await new Promise<BattleState | null>((resolve, reject) => {
        if (queuedConfigRef.current) {
          queuedConfigRef.current.resolve(null);
        }
        queuedConfigRef.current = {
          payload,
          savingUnitKey,
          showGlobalSaving,
          resolve,
          reject,
        };
        void flushQueuedConfig();
      });
    },
    [applyLocalCurrentParticipantConfig, flushQueuedConfig, getCurrentParticipantSnapshot]
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
  const selectedParticipantIsCurrentUser = Boolean(
    selectedParticipant && currentParticipant && selectedParticipant.user.id === currentParticipant.user.id
  );

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
        ...selectedUnits.heroes.map((unit) => ({ unit, sectionLabel: "Heroes" })),
        ...selectedUnits.henchmen.map((unit) => ({ unit, sectionLabel: "Henchmen" })),
        ...selectedUnits.hiredSwords.map((unit) => ({ unit, sectionLabel: "Hired Swords" })),
        ...selectedUnits.temporary.map((unit) => ({ unit, sectionLabel: "Temporary Units" })),
      ];

      for (const { unit, sectionLabel } of units) {
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
          sectionLabel,
        };
        if (participant.user.id === currentUserId) {
          options.yours.push(option);
        } else {
          options.others.push(option);
        }
      }
    }

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
      ...selectedUnits.heroes.map((unit) => ({ unit, sectionLabel: "Heroes" })),
      ...selectedUnits.henchmen.map((unit) => ({ unit, sectionLabel: "Henchmen" })),
      ...selectedUnits.hiredSwords.map((unit) => ({ unit, sectionLabel: "Hired Swords" })),
      ...selectedUnits.temporary.map((unit) => ({ unit, sectionLabel: "Temporary Units" })),
    ];

    for (const { unit, sectionLabel } of units) {
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
        sectionLabel,
      });
    }

    return options;
  }, [currentParticipant, rosters]);

  const isBattleCreator = useMemo(
    () => battleState?.battle.created_by_user_id === user?.id,
    [battleState?.battle.created_by_user_id, user?.id]
  );
  const showScenarioLinkAction = Boolean(battleState?.battle.scenario_link);

  const mobileTopBarExtraActions = useMemo(
    () =>
      selectedParticipantIsCurrentUser || showScenarioLinkAction ? (
        <>
          {selectedParticipantIsCurrentUser ? (
            <button
              type="button"
              onClick={() => setIsBattleNotesOpen(true)}
              className="icon-button flex h-9 w-9 items-center justify-center border-none bg-transparent p-0"
              aria-label="Battle Notes"
            >
              <PenLine className="theme-heading-soft h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
          {showScenarioLinkAction ? (
            <button
              type="button"
              onClick={() => setIsScenarioLinkDialogOpen(true)}
              className="icon-button mr-1 flex h-9 w-9 items-center justify-center border-none bg-transparent p-0"
              aria-label="View scenario link"
            >
              <BookOpen className="theme-heading-soft h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
        </>
      ) : null,
    [selectedParticipantIsCurrentUser, showScenarioLinkAction]
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
      applyBattleResponse(next);
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
  }, [applyBattleResponse, campaignId, numericBattleId, selectedWinnerWarbandIds]);

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
      applyBattleResponse(next);
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
  }, [applyBattleResponse, campaignId, numericBattleId]);

  const handleSetUnitOutOfAction = useCallback(
    async (unitKey: string, outOfAction: boolean) => {
      const next = await setUnitOutOfAction(campaignId, numericBattleId, {
        unit_key: unitKey,
        out_of_action: outOfAction,
      });
      applyBattleResponse(next);
    },
    [applyBattleResponse, campaignId, numericBattleId]
  );

  const handleAdjustUnitWounds = useCallback(
    async (unit: PrebattleUnit, delta: number) => {
      if (delta === 0) {
        return;
      }

      const participant = getCurrentParticipantSnapshot();
      if (!participant) {
        return;
      }

      const unitInformation = toUnitInformationMap(participant.unit_information_json);
      const currentWounds = getCurrentUnitWounds(unit, unitInformation[unit.key]);
      const nextWounds = Math.max(0, Math.min(10, currentWounds + delta));
      if (nextWounds === currentWounds) {
        return;
      }

      const nextUnitInformation = setUnitCurrentWounds(unitInformation, unit, nextWounds);
      await saveCurrentParticipantConfig({
        unitInformation: nextUnitInformation,
        savingUnitKey: unit.key,
      });
    },
    [getCurrentParticipantSnapshot, saveCurrentParticipantConfig]
  );

  const handleSaveUnitOverride = useCallback(
    async (unitKey: string, override: UnitOverride | undefined) => {
      const participant = getCurrentParticipantSnapshot();
      if (!participant) {
        return;
      }

      const participantRoster = rosters[participant.user.id];
      const selectedUnits = getParticipantSelectedUnits(participant, participantRoster);
      const unit = [
        ...selectedUnits.heroes,
        ...selectedUnits.henchmen,
        ...selectedUnits.hiredSwords,
        ...selectedUnits.temporary,
      ].find((entry) => entry.key === unitKey);

      if (!unit) {
        throw new Error("Unable to find unit for active edit");
      }

      const unitInformation = toUnitInformationMap(participant.unit_information_json);
      const nextUnitInformation = updateUnitInformationOverride(unitInformation, unit, override);
      await saveCurrentParticipantConfig({
        unitInformation: nextUnitInformation,
        savingUnitKey: unitKey,
      });
    },
    [getCurrentParticipantSnapshot, rosters, saveCurrentParticipantConfig]
  );

  const handleSaveUnitNotes = useCallback(
    async (unitKey: string, notes: string) => {
      const participant = getCurrentParticipantSnapshot();
      if (!participant) {
        return;
      }

      const unitInformation = toUnitInformationMap(participant.unit_information_json);
      const nextUnitInformation = updateUnitInformationNotes(unitInformation, unitKey, notes);
      await saveCurrentParticipantConfig({
        unitInformation: nextUnitInformation,
        savingUnitKey: unitKey,
        showGlobalSaving: false,
      });
    },
    [getCurrentParticipantSnapshot, saveCurrentParticipantConfig]
  );

  useEffect(() => {
    if (!selectedParticipantIsCurrentUser && isBattleNotesOpen) {
      setIsBattleNotesOpen(false);
    }
  }, [isBattleNotesOpen, selectedParticipantIsCurrentUser]);

  const handleSaveBattleNotes = useCallback(
    async (battleNotes: string) => {
      await saveCurrentParticipantConfig({
        battleNotes,
        showGlobalSaving: false,
      });
    },
    [saveCurrentParticipantConfig]
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
      applyBattleResponse(next);
    },
    [applyBattleResponse, campaignId, numericBattleId]
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
        applyBattleResponse(next);
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
    [applyBattleResponse, battleState, campaignId, currentParticipant, numericBattleId]
  );

  const desktopSubnavActions = useMemo(
    () => (
      <>
        {selectedParticipantIsCurrentUser ? (
          <>
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsBattleNotesOpen(true)}>
              Battle Notes
            </Button>
            <div className="mx-1 h-7 w-px bg-border/70" aria-hidden="true" />
          </>
        ) : null}
        <ActiveBattleHelpers
          rangedDisabled={rangedUnitOptions.length === 0}
          meleeDisabled={meleeUnitOptions.yours.length === 0 || meleeUnitOptions.others.length === 0}
          showScenarioAction={showScenarioLinkAction}
          onOpenRanged={() => setIsRangedDialogOpen(true)}
          onOpenMelee={() => setIsMeleeDialogOpen(true)}
          onOpenCriticalHits={() => setIsCriticalHitDialogOpen(true)}
          onOpenScenario={() => setIsScenarioLinkDialogOpen(true)}
        />
      </>
    ),
    [
      meleeUnitOptions.others.length,
      meleeUnitOptions.yours.length,
      rangedUnitOptions.length,
      selectedParticipantIsCurrentUser,
      showScenarioLinkAction,
    ]
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
    const participant = getCurrentParticipantSnapshot();
    if (!participant) {
      return;
    }

    const name = customUnitDraft.name.trim();
    const unitType = customUnitDraft.unitType.trim();
    if (!name || !unitType) {
      setCustomUnitFormError("Temporary units need a name and unit type.");
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
    };

    const existingCustomUnits = normalizeCustomUnits(participant.custom_units_json);
    const nextCustomUnits = [...existingCustomUnits, unit];
    const nextSelectedUnitKeys = Array.from(
      new Set([...(participant.selected_unit_keys_json ?? []), unit.key])
    );

    try {
      const next = await saveCurrentParticipantConfig({
        selectedUnitKeys: nextSelectedUnitKeys,
        unitInformation: toUnitInformationMap(participant.unit_information_json),
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
  }, [customUnitDraft, getCurrentParticipantSnapshot, saveCurrentParticipantConfig]);

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

  return (
    <div className="battle-page battle-active-page min-h-0 space-y-4 px-2 pb-24 sm:px-0">
      {!isMobile ? (
        <BattleDesktopSubnav
          title="Battle"
          subtitle={`Session #${battleId ?? "-"}${battleState.battle.scenario ? ` - ${battleState.battle.scenario}` : ""}`}
          participants={statusParticipants}
          selectedParticipantUserId={selectedParticipantUserId}
          onSelectParticipant={setSelectedParticipantUserId}
          actions={desktopSubnavActions}
        />
      ) : null}

      {isMobile && selectedParticipant ? (
        <div className="flex flex-wrap items-center justify-center gap-2 px-2">
          <ActiveBattleHelpers
            showLabel={false}
            rangedDisabled={rangedUnitOptions.length === 0}
            meleeDisabled={meleeUnitOptions.yours.length === 0 || meleeUnitOptions.others.length === 0}
            showScenarioAction={showScenarioLinkAction}
            onOpenRanged={() => setIsRangedDialogOpen(true)}
            onOpenMelee={() => setIsMeleeDialogOpen(true)}
            onOpenCriticalHits={() => setIsCriticalHitDialogOpen(true)}
            onOpenScenario={() => setIsScenarioLinkDialogOpen(true)}
          />
        </div>
      ) : null}

      {isSelectedRosterLoading ? (
        <CardBackground className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Loading units...</p>
        </CardBackground>
      ) : selectedParticipant ? (
        <ActiveParticipantRoster
          participant={selectedParticipant}
          participantRoster={selectedParticipantRoster}
          rosterLoading={Boolean(rosterLoading[selectedParticipant.user.id])}
          rosterError={rosterErrors[selectedParticipant.user.id]}
          unitInformationByKey={selectedParticipantUnitInformation}
          killTargetOptions={killTargetOptions}
          canInteract={canInteractWithSelectedParticipant}
          onSetOutOfAction={handleSetUnitOutOfAction}
          onAdjustWounds={handleAdjustUnitWounds}
          onSaveOverride={handleSaveUnitOverride}
          onSaveUnitNotes={handleSaveUnitNotes}
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
      {currentParticipant ? (
        <BattleNotesDialog
          open={isBattleNotesOpen}
          notes={currentParticipant.battle_notes ?? ""}
          onOpenChange={setIsBattleNotesOpen}
          onSave={handleSaveBattleNotes}
        />
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
