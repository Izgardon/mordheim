import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { PageHeader } from "@/components/ui/page-header";
import {
  appendBattleEvent,
  cancelBattleAsCreator,
  getBattleState,
  joinBattle,
  saveBattleParticipantConfig,
  setBattleReady,
  startBattle,
} from "@/features/battles/api/battles-api";
import type { BattleState } from "@/features/battles/types/battle-types";
import PrebattleActionBar from "@/features/battles/components/prebattle/PrebattleActionBar";
import PrebattleCustomUnitBuilder from "@/features/battles/components/prebattle/PrebattleCustomUnitBuilder";
import PrebattleDialogs from "@/features/battles/components/prebattle/PrebattleDialogs";
import PrebattleInviteGate from "@/features/battles/components/prebattle/PrebattleInviteGate";
import PrebattleParticipantRoster from "@/features/battles/components/prebattle/PrebattleParticipantRoster";
import PrebattleStatusSummary from "@/features/battles/components/prebattle/PrebattleStatusSummary";
import {
  DEFAULT_CUSTOM_UNIT_DRAFT,
  type CustomUnitDraft,
  type PrebattleUnit,
  type StatKey,
  type UnitSingleUseItem,
  type UnitOverride,
} from "@/features/battles/components/prebattle/prebattle-types";
import {
  usePrebattleMobileBottomBar,
  usePrebattleMobileTopBar,
} from "@/features/battles/components/prebattle/usePrebattleMobileBars";
import { usePrebattleRosters } from "@/features/battles/components/prebattle/usePrebattleRosters";
import { participantStatusLabel } from "@/features/battles/components/prebattle/prebattle-utils";
import {
  flattenRosterUnits,
  normalizeCustomUnits,
  normalizeOverrides,
  serializeCustomUnits,
  toArmourSaveStat,
  toNumericStat,
  toUnitRating,
} from "@/features/battles/components/prebattle/prebattle-utils";
import BestiaryPicker from "@/features/bestiary/components/BestiaryPicker";
import type { BestiaryEntrySummary } from "@/features/bestiary/types/bestiary-types";
import type { BattleLayoutContext } from "@/features/battles/routes/BattleLayout";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useMediaQuery } from "@/lib/use-media-query";
import { createBattleSessionSocket } from "@/lib/realtime";

export default function BattlePrebattle() {
  const { id, battleId } = useParams();
  const {
    campaign,
    setBattleMobileTopBar,
    setBattleMobileBottomBar,
  } = useOutletContext<BattleLayoutContext>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 960px)");

  const campaignId = Number(id);
  const numericBattleId = Number(battleId);

  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const { rosters, rosterLoading, rosterErrors } = usePrebattleRosters(
    battleState?.participants
  );

  const [selectedUnitKeys, setSelectedUnitKeys] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, UnitOverride>>({});
  const [customUnits, setCustomUnits] = useState<PrebattleUnit[]>([]);
  const [showAddCustomUnit, setShowAddCustomUnit] = useState(false);
  const [showBestiaryPicker, setShowBestiaryPicker] = useState(false);
  const [customUnitDraft, setCustomUnitDraft] = useState<CustomUnitDraft>({
    ...DEFAULT_CUSTOM_UNIT_DRAFT,
  });
  const [editingUnitKey, setEditingUnitKey] = useState<string | null>(null);
  const [selectedParticipantUserId, setSelectedParticipantUserId] = useState<number | null>(null);
  const [localRatingInputsByUserId, setLocalRatingInputsByUserId] = useState<Record<number, string>>(
    {}
  );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isUpdatingReady, setIsUpdatingReady] = useState(false);
  const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
  const [isStartingBattle, setIsStartingBattle] = useState(false);
  const [startError, setStartError] = useState("");
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [activeItemActionKey, setActiveItemActionKey] = useState<string | null>(null);
  const [isCancelBattleDialogOpen, setIsCancelBattleDialogOpen] = useState(false);
  const [isCancelingBattle, setIsCancelingBattle] = useState(false);
  const [cancelBattleError, setCancelBattleError] = useState("");
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);

  const configInitializedRef = useRef(false);
  const lastSavedConfigHashRef = useRef("");
  const suppressReadyResetOnExitRef = useRef(false);

  const buildConfigPayload = useCallback(
    (units: PrebattleUnit[], selectedKeys: string[], unitOverrides: Record<string, UnitOverride>) => ({
      selected_unit_keys_json: selectedKeys,
      stat_overrides_json: unitOverrides,
      custom_units_json: serializeCustomUnits(units),
    }),
    []
  );

  const refreshBattleState = useCallback(async () => {
    if (Number.isNaN(campaignId) || Number.isNaN(numericBattleId)) {
      return;
    }
    const state = await getBattleState(campaignId, numericBattleId, 0);
    if (state.battle.status !== "prebattle") {
      suppressReadyResetOnExitRef.current = true;
    }
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
          if (state.battle.status !== "prebattle") {
            suppressReadyResetOnExitRef.current = true;
          }
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
    if (!battleState || !currentParticipant) {
      return;
    }
    if (battleState.battle.status === "prebattle" && currentParticipant.status === "accepted") {
      void joinBattle(campaignId, numericBattleId)
        .then((next) => setBattleState(next))
        .catch(() => undefined);
    }
  }, [battleState, campaignId, currentParticipant, numericBattleId]);

  const ownRoster = currentParticipant ? rosters[currentParticipant.user.id] : undefined;
  const ownRosterUnits = useMemo(() => flattenRosterUnits(ownRoster), [ownRoster]);
  const ownUnits = useMemo(() => [...ownRosterUnits, ...customUnits], [customUnits, ownRosterUnits]);
  const ownUnitMap = useMemo(() => new Map(ownUnits.map((unit) => [unit.key, unit])), [ownUnits]);
  const ownUnitKeys = useMemo(() => ownUnits.map((unit) => unit.key), [ownUnits]);

  useEffect(() => {
    configInitializedRef.current = false;
    suppressReadyResetOnExitRef.current = false;
    setActiveItemActionKey(null);
    setCustomUnits([]);
    setCustomUnitDraft({ ...DEFAULT_CUSTOM_UNIT_DRAFT });
    setShowAddCustomUnit(false);
  }, [numericBattleId, currentParticipant?.id]);

  useEffect(() => {
    if (!currentParticipant || !ownRoster || configInitializedRef.current) {
      return;
    }

    const serverCustomUnits = normalizeCustomUnits(currentParticipant.custom_units_json);
    const serverOverrides = normalizeOverrides(currentParticipant.stat_overrides_json);
    const availableKeys = [
      ...flattenRosterUnits(ownRoster).map((unit) => unit.key),
      ...serverCustomUnits.map((unit) => unit.key),
    ];
    const serverSelected = (currentParticipant.selected_unit_keys_json || []).filter((key) =>
      availableKeys.includes(key)
    );
    const normalizedSelected = serverSelected.length ? serverSelected : availableKeys;
    const serverPayloadHash = JSON.stringify(
      buildConfigPayload(serverCustomUnits, serverSelected, serverOverrides)
    );
    const localPayloadHash = JSON.stringify(
      buildConfigPayload(serverCustomUnits, normalizedSelected, serverOverrides)
    );

    setCustomUnits(serverCustomUnits);
    setSelectedUnitKeys(normalizedSelected);
    setOverrides(serverOverrides);
    // If server had no saved selected keys, local defaults to all available keys.
    // Keep the server hash so first Ready Up triggers a persistence write.
    lastSavedConfigHashRef.current = serverPayloadHash === localPayloadHash ? localPayloadHash : serverPayloadHash;
    configInitializedRef.current = true;
  }, [buildConfigPayload, currentParticipant, ownRoster]);

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

  const selectedParticipantCustomUnits = useMemo(() => {
    if (!selectedParticipant) {
      return [];
    }
    if (selectedParticipantIsCurrentUser) {
      return customUnits;
    }
    return normalizeCustomUnits(selectedParticipant.custom_units_json);
  }, [customUnits, selectedParticipant, selectedParticipantIsCurrentUser]);

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

  const statusRatingByUserId = useMemo(() => {
    const ratings: Record<number, number | null> = {};
    const participants = battleState?.participants ?? [];
    const currentUserId = currentParticipant?.user.id;
    for (const participant of participants) {
      const customUnitSource =
        participant.user.id === currentUserId
          ? customUnits
          : normalizeCustomUnits(participant.custom_units_json);
      const customRatingTotal = customUnitSource.reduce(
        (sum, unit) => sum + toUnitRating(unit.rating),
        0
      );
      const baseRating = participant.declared_rating;
      ratings[participant.user.id] =
        baseRating === null && customRatingTotal === 0
          ? null
          : (baseRating ?? 0) + customRatingTotal;
    }
    return ratings;
  }, [battleState?.participants, currentParticipant?.user.id, customUnits]);

  useEffect(() => {
    const participants = battleState?.participants ?? [];
    if (participants.length === 0) {
      setLocalRatingInputsByUserId({});
      return;
    }

    setLocalRatingInputsByUserId((prev) => {
      const next: Record<number, string> = {};
      for (const participant of participants) {
        const participantUserId = participant.user.id;
        if (participantUserId in prev) {
          next[participantUserId] = prev[participantUserId];
          continue;
        }
        const defaultRating = statusRatingByUserId[participantUserId];
        next[participantUserId] = defaultRating === null ? "" : String(defaultRating);
      }
      return next;
    });
  }, [battleState?.participants, statusRatingByUserId]);

  const getParticipantLocalRating = useCallback(
    (participantUserId: number): number | null => {
      const localValue = localRatingInputsByUserId[participantUserId];
      if (localValue !== undefined) {
        if (!localValue.trim()) {
          return null;
        }
        const parsed = Number(localValue);
        return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
      }
      return statusRatingByUserId[participantUserId] ?? null;
    },
    [localRatingInputsByUserId, statusRatingByUserId]
  );

  const selectedParticipantRoster = selectedParticipant
    ? rosters[selectedParticipant.user.id]
    : undefined;

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

  const allParticipantsReady = useMemo(() => {
    const participants = battleState?.participants ?? [];
    return participants.length > 0 && participants.every((participant) => participant.status === "ready");
  }, [battleState?.participants]);

  const currentUserReady = currentParticipant?.status === "ready";
  const invitePending = battleState?.battle.status === "inviting";
  const canAcceptInvite = invitePending && currentParticipant?.status === "invited";
  const waitingForOthers = invitePending && currentParticipant?.status === "accepted";
  const isBattleCreator = battleState?.battle.created_by_user_id === user?.id;
  const canCreatorCancelBattle =
    isBattleCreator &&
    (battleState?.battle.status === "inviting" || battleState?.battle.status === "prebattle");

  const readyDisabled =
    invitePending ||
    isUpdatingReady ||
    battleState?.battle.status !== "prebattle" ||
    !currentParticipant ||
    currentParticipant.status === "accepted" ||
    currentParticipant.status === "canceled_prebattle";
  const startDisabled =
    !allParticipantsReady || battleState?.battle.status !== "prebattle" || isStartingBattle;

  const handleLeaveBattle = useCallback(() => {
    setIsLeaveDialogOpen(false);
    navigate(`/campaigns/${campaignId}`);
  }, [campaignId, navigate]);

  useEffect(() => {
    return () => {
      if (
        suppressReadyResetOnExitRef.current ||
        Number.isNaN(campaignId) ||
        Number.isNaN(numericBattleId) ||
        battleState?.battle.status !== "prebattle" ||
        currentParticipant?.status !== "ready"
      ) {
        return;
      }
      void setBattleReady(campaignId, numericBattleId, false).catch(() => undefined);
    };
  }, [
    battleState?.battle.status,
    campaignId,
    currentParticipant?.status,
    numericBattleId,
  ]);

  const validateOverrideReasons = () => {
    for (const [unitKey, unitOverride] of Object.entries(overrides)) {
      const hasChanges = Object.keys(unitOverride?.stats || {}).length > 0;
      if (hasChanges && !unitOverride.reason.trim()) {
        const unitName = ownUnitMap.get(unitKey)?.displayName ?? "a unit";
        return `Add a reason for temporary stat changes on ${unitName}.`;
      }
    }
    return "";
  };

  const persistParticipantConfig = useCallback(async () => {
    if (!currentParticipant || !configInitializedRef.current) {
      return true;
    }
    const payload = buildConfigPayload(customUnits, selectedUnitKeys, overrides);
    const payloadHash = JSON.stringify(payload);
    if (payloadHash === lastSavedConfigHashRef.current) {
      return true;
    }

    setIsSavingConfig(true);
    try {
      await saveBattleParticipantConfig(campaignId, numericBattleId, payload);
      lastSavedConfigHashRef.current = payloadHash;
      return true;
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setActionError(errorResponse.message || "Unable to save unit config");
      } else {
        setActionError("Unable to save unit config");
      }
      return false;
    } finally {
      setIsSavingConfig(false);
    }
  }, [
    buildConfigPayload,
    campaignId,
    currentParticipant,
    customUnits,
    numericBattleId,
    overrides,
    selectedUnitKeys,
  ]);

  const handleApplyStatChanges = async () => {
    const reasonError = validateOverrideReasons();
    if (reasonError) {
      setActionError(reasonError);
      return;
    }
    setActionError("");
    const saved = await persistParticipantConfig();
    if (saved) {
      setEditingUnitKey(null);
    }
  };

  const validateReadyUp = () => {
    const selectedOwnCount = ownUnitKeys.filter((key) => selectedUnitKeys.includes(key)).length;
    if (selectedOwnCount === 0) {
      return "Select at least one unit to bring into battle.";
    }
    return validateOverrideReasons();
  };

  const handleAcceptInvite = async () => {
    setIsAcceptingInvite(true);
    setActionError("");
    try {
      const next = await joinBattle(campaignId, numericBattleId);
      setBattleState(next);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setActionError(errorResponse.message || "Unable to accept invitation");
      } else {
        setActionError("Unable to accept invitation");
      }
    } finally {
      setIsAcceptingInvite(false);
    }
  };

  async function handleToggleReady() {
    if (!battleState || !currentParticipant) {
      return;
    }

    const targetReady = !currentUserReady;
    if (targetReady) {
      const validationError = validateReadyUp();
      if (validationError) {
        setActionError(validationError);
        return;
      }
    }

    setIsUpdatingReady(true);
    setActionError("");
    try {
      if (targetReady) {
        const saved = await persistParticipantConfig();
        if (!saved) {
          return;
        }
      }
      const next = await setBattleReady(campaignId, numericBattleId, targetReady);
      setBattleState(next);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setActionError(errorResponse.message || "Unable to update ready state");
      } else {
        setActionError("Unable to update ready state");
      }
    } finally {
      setIsUpdatingReady(false);
    }
  }

  const handleSelectParticipantUserId = useCallback((participantUserId: number) => {
    setSelectedParticipantUserId(participantUserId);
  }, []);

  const { sectionIdByKey } = usePrebattleMobileTopBar({
    isMobile,
    setBattleMobileTopBar,
    title: "In Prebattle",
    onBack: () => setIsLeaveDialogOpen(true),
    statusParticipants,
    selectedParticipant,
    selectedParticipantRoster,
    selectedParticipantCustomUnits,
    onSelectParticipantUserId: handleSelectParticipantUserId,
  });

  usePrebattleMobileBottomBar({
    isMobile,
    setBattleMobileBottomBar,
    isUpdatingReady,
    currentUserReady: Boolean(currentUserReady),
    readyDisabled,
    onToggleReady: handleToggleReady,
    isBattleCreator,
    isStartingBattle,
    startDisabled,
    canCreatorCancelBattle,
    isCancelingBattle,
    onOpenStart: () => setIsStartDialogOpen(true),
    onOpenCancel: () => setIsCancelBattleDialogOpen(true),
  });

  const handleCancelBattleAsCreator = async () => {
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
  };

  const handleStartBattle = async () => {
    setIsStartingBattle(true);
    setStartError("");
    try {
      const next = await startBattle(campaignId, numericBattleId);
      suppressReadyResetOnExitRef.current = true;
      setBattleState(next);
      setIsStartDialogOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setStartError(errorResponse.message || "Unable to start battle");
      } else {
        setStartError("Unable to start battle");
      }
    } finally {
      setIsStartingBattle(false);
    }
  };

  const handleUseSingleUseItem = async (unit: PrebattleUnit, item: UnitSingleUseItem) => {
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
  };

  const toggleUnitSelection = (unitKey: string) => {
    setSelectedUnitKeys((prev) =>
      prev.includes(unitKey) ? prev.filter((entry) => entry !== unitKey) : [...prev, unitKey]
    );
  };

  const updateOverrideStat = (unit: PrebattleUnit, key: StatKey, value: string) => {
    setOverrides((prev) => {
      const current = prev[unit.key] ?? { reason: "", stats: {} };
      const nextStats = { ...current.stats };

      const parsedNumeric = value.trim() === "" ? null : toNumericStat(Number(value));
      if (parsedNumeric === null || parsedNumeric === unit.stats[key]) {
        delete nextStats[key];
      } else {
        nextStats[key] = parsedNumeric;
      }

      const hasStats = Object.keys(nextStats).length > 0;
      if (!hasStats && !current.reason.trim()) {
        const next = { ...prev };
        delete next[unit.key];
        return next;
      }

      return {
        ...prev,
        [unit.key]: { ...current, stats: nextStats },
      };
    });
  };

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

  const addCustomUnit = () => {
    const name = customUnitDraft.name.trim();
    const unitType = customUnitDraft.unitType.trim();
    const reason = customUnitDraft.reason.trim();
    if (!name || !unitType) {
      setActionError("Temporary units need a name and unit type.");
      return;
    }
    if (!reason) {
      setActionError("Temporary units need a reason.");
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

    setCustomUnits((prev) => [...prev, unit]);
    setSelectedUnitKeys((prev) => [...prev, unit.key]);
    setCustomUnitDraft({ ...DEFAULT_CUSTOM_UNIT_DRAFT });
    setShowAddCustomUnit(false);
    setActionError("");
  };

  const addBestiaryUnit = (entry: BestiaryEntrySummary) => {
    const bestiaryKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `bestiary:${entry.id}:${crypto.randomUUID()}`
        : `bestiary:${entry.id}:${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const unit: PrebattleUnit = {
      key: bestiaryKey,
      id: bestiaryKey,
      kind: "bestiary",
      displayName: entry.name,
      unitType: entry.type,
      rating: 0,
      stats: {
        movement: entry.movement,
        weapon_skill: entry.weapon_skill,
        ballistic_skill: entry.ballistic_skill,
        strength: entry.strength,
        toughness: entry.toughness,
        wounds: entry.wounds,
        initiative: entry.initiative,
        attacks: entry.attacks,
        leadership: entry.leadership,
        armour_save: entry.armour_save || "",
      },
      customReason: `From bestiary: ${entry.name}`,
    };

    setCustomUnits((prev) => [...prev, unit]);
    setSelectedUnitKeys((prev) => [...prev, unit.key]);
    setShowBestiaryPicker(false);
    setActionError("");
  };

  const removeCustomUnit = (unitKey: string) => {
    setCustomUnits((prev) => prev.filter((unit) => unit.key !== unitKey));
    setSelectedUnitKeys((prev) => prev.filter((key) => key !== unitKey));
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[unitKey];
      return next;
    });
    setEditingUnitKey((prev) => (prev === unitKey ? null : prev));
  };

  const updateOverrideReason = (unitKey: string, reason: string) => {
    setOverrides((prev) => {
      const current = prev[unitKey] ?? { reason: "", stats: {} };
      const hasStats = Object.keys(current.stats).length > 0;
      if (!hasStats && !reason.trim()) {
        const next = { ...prev };
        delete next[unitKey];
        return next;
      }
      return {
        ...prev,
        [unitKey]: {
          ...current,
          reason,
        },
      };
    });
  };

  const clearUnitOverride = (unitKey: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[unitKey];
      return next;
    });
  };

  if (isLoading) {
    return <LoadingScreen message="Loading prebattle..." />;
  }

  if (error || !battleState) {
    return <p className="text-sm text-red-600">{error || "Unable to load prebattle."}</p>;
  }

  if (battleState.battle.status === "canceled" || battleState.battle.status === "ended") {
    return <Navigate to={`/campaigns/${campaignId}`} replace />;
  }

  if (battleState.battle.status === "active") {
    return <Navigate to={`/campaigns/${campaignId}/battles/${numericBattleId}/active`} replace />;
  }

  const participantIds = battleState.participants.map((participant) => participant.user.id);
  const hasRosterResultForAllParticipants = participantIds.every(
    (participantUserId) => Boolean(rosters[participantUserId] || rosterErrors[participantUserId])
  );
  const hasPendingRosterRequests = participantIds.some(
    (participantUserId) => Boolean(rosterLoading[participantUserId])
  );
  if (!invitePending && participantIds.length > 0 && (!hasRosterResultForAllParticipants || hasPendingRosterRequests)) {
    return <LoadingScreen message="Loading prebattle..." />;
  }

  const headerSubtitleParts = [`Session #${numericBattleId}`];
  if (battleState.battle.title) {
    headerSubtitleParts.push(battleState.battle.title);
  }
  const isSelectedRosterLoading = Boolean(
    !invitePending &&
      selectedParticipant &&
      rosterLoading[selectedParticipant.user.id] &&
      !rosters[selectedParticipant.user.id]
  );

  return (
    <div className="min-h-0 space-y-4 pb-24 px-2 sm:px-0">
      {!isMobile ? (
        <>
          <PageHeader
            title={`${campaign?.name ?? "Campaign"} - Prebattle`}
            subtitle={headerSubtitleParts.join(" • ")}
          />
          <PrebattleStatusSummary
            participants={statusParticipants}
            getStatusLabel={participantStatusLabel}
            getParticipantRating={(participant) => getParticipantLocalRating(participant.user.id)}
            selectedParticipantUserId={selectedParticipantUserId}
            onSelectParticipant={setSelectedParticipantUserId}
          />
        </>
      ) : null}

      {isSavingConfig ? (
        <p className="text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground">
          Saving unit config...
        </p>
      ) : null}
      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}

      {invitePending ? (
        <PrebattleInviteGate
          canAcceptInvite={Boolean(canAcceptInvite)}
          isAcceptingInvite={isAcceptingInvite}
          waitingForOthers={Boolean(waitingForOthers)}
          canCreatorCancelBattle={Boolean(canCreatorCancelBattle)}
          isCancelingBattle={isCancelingBattle}
          onAcceptInvite={handleAcceptInvite}
          onOpenCancelBattle={() => setIsCancelBattleDialogOpen(true)}
        />
      ) : (
        <>
          {isSelectedRosterLoading ? (
            <CardBackground className="p-4 sm:p-5">
              <p className="text-sm text-muted-foreground">Loading units...</p>
            </CardBackground>
          ) : null}
          {selectedParticipant ? (
            isSelectedRosterLoading ? null : (
              <PrebattleParticipantRoster
                participant={selectedParticipant}
                editable={selectedParticipantIsCurrentUser}
                ratingInputValue={
                  localRatingInputsByUserId[selectedParticipant.user.id] ??
                  (statusRatingByUserId[selectedParticipant.user.id] === null
                    ? ""
                    : String(statusRatingByUserId[selectedParticipant.user.id]))
                }
                onRatingInputChange={(value) =>
                  setLocalRatingInputsByUserId((prev) => ({
                    ...prev,
                    [selectedParticipant.user.id]: value.replace(/[^\d]/g, ""),
                  }))
                }
                participantRoster={rosters[selectedParticipant.user.id]}
                rosterLoading={Boolean(rosterLoading[selectedParticipant.user.id])}
                rosterError={rosterErrors[selectedParticipant.user.id]}
                participantSelectedKeys={selectedParticipant.selected_unit_keys_json || []}
                participantOverrides={normalizeOverrides(selectedParticipant.stat_overrides_json)}
                participantCustomUnits={selectedParticipantCustomUnits}
                selectedUnitKeys={selectedUnitKeys}
                ownOverrides={overrides}
                editingUnitKey={editingUnitKey}
                onToggleUnitSelection={toggleUnitSelection}
                onToggleEditingUnit={(unitKey) =>
                  setEditingUnitKey((prev) => (prev === unitKey ? null : unitKey))
                }
                onUpdateOverrideStat={updateOverrideStat}
                onUpdateOverrideReason={updateOverrideReason}
                onClearUnitOverride={clearUnitOverride}
                onRemoveCustomUnit={removeCustomUnit}
                canUseItems={true}
                onUseSingleUseItem={handleUseSingleUseItem}
                getUsedSingleUseItemCount={getUsedSingleUseItemCount}
                activeItemActionKey={activeItemActionKey}
                onApplyStatChanges={handleApplyStatChanges}
                isApplyingStatChanges={isSavingConfig}
                sectionIds={sectionIdByKey}
              />
            )
          ) : (
            <CardBackground className="p-4 sm:p-5">
              <p className="text-sm text-muted-foreground">No warbands available yet.</p>
            </CardBackground>
          )}

          {selectedParticipantIsCurrentUser && !isSelectedRosterLoading ? (
            <>
              <PrebattleCustomUnitBuilder
                open={showAddCustomUnit}
                draft={customUnitDraft}
                onToggleOpen={() => setShowAddCustomUnit((prev) => !prev)}
                onDraftChange={setCustomUnitDraft}
                onDraftStatChange={updateCustomDraftStat}
                onSave={addCustomUnit}
              />
              {showBestiaryPicker ? (
                <BestiaryPicker
                  campaignId={campaignId}
                  onSelect={addBestiaryUnit}
                  onClose={() => setShowBestiaryPicker(false)}
                />
              ) : (
                <CardBackground className="p-3 sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                      Bestiary Units
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowBestiaryPicker(true)}
                    >
                      Add from Bestiary
                    </Button>
                  </div>
                </CardBackground>
              )}
            </>
          ) : null}
        </>
      )}

      {!isMobile ? (
        <PrebattleActionBar
          isSavingConfig={isSavingConfig}
          actionError={actionError}
          invitePending={invitePending}
          battleStatus={battleState.battle.status}
          hasCurrentParticipant={Boolean(currentParticipant)}
          currentParticipantStatus={currentParticipant?.status}
          currentUserReady={Boolean(currentUserReady)}
          isUpdatingReady={isUpdatingReady}
          isCancelingBattle={isCancelingBattle}
          isStartingBattle={isStartingBattle}
          allParticipantsReady={allParticipantsReady}
          isBattleCreator={Boolean(isBattleCreator)}
          canCreatorCancelBattle={Boolean(canCreatorCancelBattle)}
          onToggleReady={handleToggleReady}
          onOpenCreatorCancel={() => setIsCancelBattleDialogOpen(true)}
          onOpenStartDialog={() => setIsStartDialogOpen(true)}
        />
      ) : null}

      <PrebattleDialogs
        isLeaveDialogOpen={isLeaveDialogOpen}
        onLeaveDialogChange={setIsLeaveDialogOpen}
        onConfirmLeave={handleLeaveBattle}
        isStartDialogOpen={isStartDialogOpen}
        onStartDialogChange={(open) => {
          setIsStartDialogOpen(open);
          if (!open) {
            setStartError("");
          }
        }}
        startError={startError}
        isStartingBattle={isStartingBattle}
        onConfirmStart={handleStartBattle}
        isCancelBattleDialogOpen={isCancelBattleDialogOpen}
        onCancelBattleDialogChange={(open) => {
          setIsCancelBattleDialogOpen(open);
          if (!open) {
            setCancelBattleError("");
          }
        }}
        cancelBattleError={cancelBattleError}
        isCancelingBattle={isCancelingBattle}
        onConfirmCancelBattle={handleCancelBattleAsCreator}
      />
    </div>
  );
}

