import { useEffect, useMemo, useState } from "react";

import TabSwitcher from "@/components/ui/tab-switcher";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { createBattle, reportBattleResult } from "@/features/battles/api/battles-api";
import { normalizeWebUrl } from "@/lib/url-utils";
import type { CampaignPlayer } from "../../types/campaign-types";
import { idleLabel } from "@/features/battles/utils/battle-timing";
import { toastBattleWarnings } from "@/features/battles/utils/battle-warnings";
import UnfinishedBattleBanner from "@/features/battles/components/shared/UnfinishedBattleBanner";
import { getErrorMessage } from "@/lib/get-error-message";

/** "In battle #40 (postbattle), idle 6 days" from the players' busy fields (decision 1). */
function battleBusyLabel(player: CampaignPlayer) {
  const battle = player.battle_busy_battle_id
    ? `battle #${player.battle_busy_battle_id}`
    : "a battle";
  const phase = player.battle_busy_status ? ` (${player.battle_busy_status})` : "";
  const idle = idleLabel(player.battle_busy_last_activity_at);
  return `In ${battle}${phase}${idle ? `, ${idle}` : ""}`;
}

type StartBattleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  creatorUserId: number;
  players: CampaignPlayer[];
  onBattleCreated?: () => void;
};

type BattleDialogMode = "start_battle" | "report_result";

const MODE_TABS = [
  { id: "start_battle", label: "Battle" },
  { id: "report_result", label: "Report" },
] as const;

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function StartBattleDialog({
  open,
  onOpenChange,
  campaignId,
  creatorUserId,
  players,
  onBattleCreated,
}: StartBattleDialogProps) {
  const [mode, setMode] = useState<BattleDialogMode>("start_battle");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedWinnerWarbandIds, setSelectedWinnerWarbandIds] = useState<number[]>([]);
  // A reported result can record "No winner" too (decision 8): no wins or losses.
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
        .filter((warband): warband is NonNullable<CampaignPlayer["warband"]> =>
          Boolean(warband?.id)
        ),
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
    setSelectedUserIds((prev) =>
      prev.filter((userId) => {
        return Boolean(eligiblePlayerById[userId]);
      })
    );
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

  // Busy players are greyed out but can be invited, with a warning (decision 1).
  const busyInvitees = selectedParticipants.filter(
    (player) => player.id !== creatorUserId && player.battle_busy
  );

  const handleSubmit = async () => {
    if (mode === "report_result") {
      if (participantUserIds.length < 2) {
        setError("Select at least two players.");
        return;
      }
      if (selectedWinnerWarbandIds.length < 1 && !noWinner) {
        setError("Select the winners, or No winner.");
        return;
      }
      if (!scenario.trim()) {
        setError("Scenario is required.");
        return;
      }
      if (!battleDate) {
        setError("Battle date is required.");
        return;
      }

      setIsSubmitting(true);
      setError("");
      try {
        await reportBattleResult(campaignId, {
          scenario: scenario.trim(),
          battle_date: battleDate,
          participant_user_ids: participantUserIds,
          winner_warband_ids: noWinner ? [] : selectedWinnerWarbandIds,
        });
        onOpenChange(false);
        onBattleCreated?.();
      } catch (errorResponse) {
        setError(getErrorMessage(errorResponse, "Unable to report battle result"));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const trimmedScenario = scenario.trim();
    if (!trimmedScenario) {
      setError("Scenario is required.");
      return;
    }
    if (participantUserIds.length < 2) {
      setError("Select at least two players to start a battle.");
      return;
    }

    const participantRatings: Record<string, number | null> = {};
    for (const userId of participantUserIds) {
      const rating = eligiblePlayerById[userId]?.warband?.rating;
      participantRatings[String(userId)] =
        typeof rating === "number" && Number.isFinite(rating)
          ? Math.max(0, Math.round(rating))
          : null;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const normalizedScenarioLink = normalizeWebUrl(scenarioLink);
      const created = await createBattle(campaignId, {
        scenario: trimmedScenario,
        scenario_link: normalizedScenarioLink || null,
        participant_user_ids: participantUserIds,
        participant_ratings: participantRatings,
      });
      toastBattleWarnings(created.warnings);
      onOpenChange(false);
      onBattleCreated?.();
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to create battle"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialogTitle = mode === "start_battle" ? "Start Battle" : "Report Battle Result";
  const dialogDescription =
    mode === "start_battle"
      ? "Select participants, then proceed to prebattle setup."
      : "Select who fought and which warband or warbands won. Everyone else will need to approve it.";
  const submitLabel =
    mode === "start_battle"
      ? isSubmitting
        ? "Creating..."
        : "Create battle"
      : isSubmitting
        ? "Submitting..."
        : "Submit result";
  const submitDisabled =
    isSubmitting ||
    (mode === "start_battle"
      ? eligiblePlayers.length < 2 || !scenario.trim()
      : eligiblePlayers.length < 2 ||
        !scenario.trim() ||
        !battleDate ||
        participantUserIds.length < 2 ||
        (selectedWinnerWarbandIds.length < 1 && !noWinner));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[680px]"
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <UnfinishedBattleBanner campaignId={campaignId} onGo={() => onOpenChange(false)} />
          <TabSwitcher
            tabs={MODE_TABS}
            activeTab={mode}
            onTabChange={(nextMode) => {
              setMode(nextMode);
              setError("");
            }}
            className="mx-auto"
          />

          <div className="space-y-2">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
              Scenario
            </p>
            <Input
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
              placeholder={
                mode === "start_battle"
                  ? "Breakthrough at the Old Gate..."
                  : "Skirmish at the Market Square..."
              }
              maxLength={120}
            />
          </div>

          {mode === "start_battle" ? (
            <div className="space-y-2">
              <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                Scenario Link
              </p>
              <Input
                value={scenarioLink}
                onChange={(event) => setScenarioLink(event.target.value)}
                placeholder="https://... or example.com/..."
                type="url"
              />
            </div>
          ) : null}

          {mode === "report_result" ? (
            <div className="space-y-2">
              <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                Battle Date
              </p>
              <input
                type="date"
                value={battleDate}
                onChange={(event) => setBattleDate(event.target.value)}
                className="flex h-9 w-full rounded-md border border-border/60 bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-[0_10px_20px_rgba(12,7,3,0.2)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 md:h-11"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
              Participants
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border/50 bg-black/30 p-3">
              {eligiblePlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No players with warbands available.</p>
              ) : (
                eligiblePlayers.map((player) => (
                  <div
                    key={player.id}
                    className={`grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-border/40 bg-black/30 px-3 py-2 ${
                      player.battle_busy && mode === "start_battle" ? "opacity-60" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => toggleUser(player.id)}
                      disabled={player.id === creatorUserId}
                    >
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {player.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {player.warband?.name ?? "No warband"}
                      </span>
                      {player.battle_busy ? (
                        <span className="block truncate text-[0.65rem] uppercase tracking-[0.15em] text-amber-300">
                          {battleBusyLabel(player)}
                        </span>
                      ) : null}
                    </button>
                    <div className="flex items-end gap-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground">
                          Rating
                        </span>
                        <span className="inline-flex h-6 w-10 items-center justify-center rounded border border-border/50 bg-background/60 text-xs text-foreground">
                          {typeof player.warband?.rating === "number"
                            ? Math.max(0, Math.round(player.warband.rating))
                            : "-"}
                        </span>
                      </div>
                      <Checkbox
                        checked={player.id === creatorUserId || selectedUserIds.includes(player.id)}
                        disabled={player.id === creatorUserId}
                        onChange={() => toggleUser(player.id)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {mode === "start_battle" && busyInvitees.length > 0 ? (
            <p className="text-sm text-amber-300">
              {busyInvitees
                .map((player) => `${player.name} is ${battleBusyLabel(player).toLowerCase()}`)
                .join("; ")}
              . You can still invite them; they finish that battle when they can.
            </p>
          ) : null}

          {mode === "report_result" ? (
            <>
              <div className="space-y-2">
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                  Winners
                </p>
                <div className="space-y-2 rounded-xl border border-border/50 bg-black/30 p-3">
                  {selectableWinners.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Select participants first.</p>
                  ) : (
                    selectableWinners.map((warband) => (
                      <div
                        key={warband.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-black/30 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {warband.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {warband.faction}
                          </p>
                        </div>
                        <Checkbox
                          checked={selectedWinnerWarbandIds.includes(warband.id)}
                          onChange={() => toggleWinner(warband.id)}
                        />
                      </div>
                    ))
                  )}
                  {selectableWinners.length > 0 ? (
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-black/30 px-3 py-2 text-sm font-semibold text-foreground">
                      No winner
                      <Checkbox
                        checked={noWinner}
                        onChange={(event) => {
                          setNoWinner(event.target.checked);
                          setSelectedWinnerWarbandIds([]);
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-black/20 px-3 py-2 text-sm text-muted-foreground">
                Participants:{" "}
                {selectedParticipants.length > 0
                  ? selectedParticipants
                      .map((player) => player.warband?.name ?? player.name)
                      .join(", ")
                  : "-"}
                <br />
                Winners:{" "}
                {noWinner
                  ? "No winner"
                  : selectedWinnerWarbandIds.length > 0
                    ? selectableWinners
                        .filter((warband) => selectedWinnerWarbandIds.includes(warband.id))
                        .map((warband) => warband.name)
                        .join(", ")
                    : "-"}
                <br />
                Date: {battleDate || "-"}
              </div>
            </>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSubmit} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
