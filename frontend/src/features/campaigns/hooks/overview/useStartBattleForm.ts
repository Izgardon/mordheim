import { useEffect, useMemo, useState } from "react";

// api
import { createBattle, reportBattleResult } from "@/features/battles/api/battles-api";

// other
import { toastBattleWarnings } from "@/features/battles/utils/battle-warnings";
import { getErrorMessage } from "@/lib/get-error-message";
import { normalizeWebUrl } from "@/lib/url-utils";

// types
import type { CampaignPlayer } from "../../types/campaign-types";

export type BattleDialogMode = "start_battle" | "report_result";
type Warband = NonNullable<CampaignPlayer["warband"]>;

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Each participant's warband rating as the server records it at creation (null if unknown). */
const participantRatings = (userIds: number[], byId: Record<number, CampaignPlayer>) =>
  Object.fromEntries(
    userIds.map((userId) => {
      const rating = byId[userId]?.warband?.rating;
      return [
        String(userId),
        typeof rating === "number" && Number.isFinite(rating)
          ? Math.max(0, Math.round(rating))
          : null,
      ];
    })
  );

type UseStartBattleFormParams = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  creatorUserId: number;
  players: CampaignPlayer[];
  onBattleCreated?: () => void;
};

/**
 * The Start battle dialog's form: a battle to play (scenario, link, opponents) or a result to
 * report (date, winners or No winner, decision 8). Reset each time the dialog opens; warnings the
 * server returns (campaign_not_started, decision 3) are toasted.
 */
export function useStartBattleForm({
  open,
  onOpenChange,
  campaignId,
  creatorUserId,
  players,
  onBattleCreated,
}: UseStartBattleFormParams) {
  const [mode, setMode] = useState<BattleDialogMode>("start_battle");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedWinnerWarbandIds, setSelectedWinnerWarbandIds] = useState<number[]>([]);
  const [noWinner, setNoWinner] = useState(false);
  const [scenario, setScenario] = useState("");
  const [scenarioLink, setScenarioLink] = useState("");
  const [battleDate, setBattleDate] = useState(getTodayInputValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const eligiblePlayers = useMemo(() => players.filter((player) => player.warband?.id), [players]);
  const participantUserIds = useMemo(
    () => Array.from(new Set([...selectedUserIds, creatorUserId])),
    [creatorUserId, selectedUserIds]
  );
  const eligiblePlayerById = useMemo(
    () =>
      eligiblePlayers.reduce<Record<number, CampaignPlayer>>((acc, player) => {
        acc[player.id] = player;
        return acc;
      }, {}),
    [eligiblePlayers]
  );
  const selectedParticipants = useMemo(
    () =>
      participantUserIds
        .map((userId) => eligiblePlayerById[userId])
        .filter((player): player is CampaignPlayer => Boolean(player?.warband?.id)),
    [eligiblePlayerById, participantUserIds]
  );
  const selectableWinners = useMemo(
    () =>
      selectedParticipants
        .map((player) => player.warband)
        .filter((warband): warband is Warband => Boolean(warband?.id)),
    [selectedParticipants]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setMode("start_battle");
    setSelectedUserIds([]);
    setSelectedWinnerWarbandIds([]);
    setNoWinner(false);
    setError("");
    setScenario("");
    setScenarioLink("");
    setBattleDate(getTodayInputValue());
  }, [open]);

  useEffect(() => {
    setSelectedUserIds((prev) => prev.filter((userId) => Boolean(eligiblePlayerById[userId])));
  }, [creatorUserId, eligiblePlayerById]);

  useEffect(() => {
    const selectableIds = new Set(selectableWinners.map((warband) => warband.id));
    setSelectedWinnerWarbandIds((prev) => prev.filter((warbandId) => selectableIds.has(warbandId)));
  }, [selectableWinners]);

  const toggleUser = (userId: number) => {
    if (userId === creatorUserId) {
      return;
    }
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((entry) => entry !== userId) : [...prev, userId]
    );
  };

  const toggleWinner = (warbandId: number) => {
    setNoWinner(false);
    setSelectedWinnerWarbandIds((prev) =>
      prev.includes(warbandId) ? prev.filter((entry) => entry !== warbandId) : [...prev, warbandId]
    );
  };

  const chooseNoWinner = (checked: boolean) => {
    setNoWinner(checked);
    setSelectedWinnerWarbandIds([]);
  };

  /** The first thing missing before the form can be sent, or "" when nothing is. */
  const missing = () => {
    if (mode === "report_result") {
      if (participantUserIds.length < 2) return "Select at least two players.";
      if (selectedWinnerWarbandIds.length < 1 && !noWinner) {
        return "Select the winners, or No winner.";
      }
      if (!scenario.trim()) return "Scenario is required.";
      if (!battleDate) return "Battle date is required.";
      return "";
    }
    if (!scenario.trim()) return "Scenario is required.";
    if (participantUserIds.length < 2) return "Select at least two players to start a battle.";
    return "";
  };

  const send = () =>
    mode === "report_result"
      ? reportBattleResult(campaignId, {
          scenario: scenario.trim(),
          battle_date: battleDate,
          participant_user_ids: participantUserIds,
          winner_warband_ids: noWinner ? [] : selectedWinnerWarbandIds,
        })
      : createBattle(campaignId, {
          scenario: scenario.trim(),
          scenario_link: normalizeWebUrl(scenarioLink) || null,
          participant_user_ids: participantUserIds,
          participant_ratings: participantRatings(participantUserIds, eligiblePlayerById),
        });

  const handleSubmit = async () => {
    const problem = missing();
    if (problem) {
      setError(problem);
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const answer = await send();
      toastBattleWarnings(answer.warnings);
      onOpenChange(false);
      onBattleCreated?.();
    } catch (errorResponse) {
      const fallback =
        mode === "report_result" ? "Unable to report battle result" : "Unable to create battle";
      setError(getErrorMessage(errorResponse, fallback));
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeMode = (nextMode: BattleDialogMode) => {
    setMode(nextMode);
    setError("");
  };

  const isReport = mode === "report_result";
  const submitDisabled =
    isSubmitting ||
    eligiblePlayers.length < 2 ||
    !scenario.trim() ||
    (isReport &&
      (!battleDate ||
        participantUserIds.length < 2 ||
        (selectedWinnerWarbandIds.length < 1 && !noWinner)));

  return {
    mode,
    changeMode,
    scenario,
    setScenario,
    scenarioLink,
    setScenarioLink,
    battleDate,
    setBattleDate,
    eligiblePlayers,
    selectedUserIds,
    toggleUser,
    // Busy players are greyed out but can be invited, with a warning (decision 1).
    busyInvitees: selectedParticipants.filter(
      (player) => player.id !== creatorUserId && player.battle_busy
    ),
    selectedParticipants,
    selectableWinners,
    selectedWinnerWarbandIds,
    toggleWinner,
    noWinner,
    chooseNoWinner,
    isSubmitting,
    submitDisabled,
    error,
    handleSubmit,
  };
}
