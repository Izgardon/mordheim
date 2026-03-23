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
import type { CampaignPlayer } from "../../types/campaign-types";

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
  const [scenario, setScenario] = useState("");
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const eligiblePlayers = useMemo(
    () => players.filter((player) => player.warband?.id),
    [players]
  );
  const availablePlayers = useMemo(
    () => eligiblePlayers.filter((player) => player.id === creatorUserId || !player.battle_busy),
    [creatorUserId, eligiblePlayers]
  );
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
        .filter((warband): warband is NonNullable<CampaignPlayer["warband"]> => Boolean(warband?.id)),
    [selectedParticipants]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setMode("start_battle");
    setSelectedUserIds([]);
    setSelectedWinnerWarbandIds([]);
    setError("");
    setScenario("");
    setTitle("");
  }, [open]);

  useEffect(() => {
    setSelectedUserIds((prev) =>
      prev.filter((userId) => {
        const player = eligiblePlayerById[userId];
        return Boolean(player && (player.id === creatorUserId || !player.battle_busy));
      })
    );
  }, [creatorUserId, eligiblePlayerById]);

  useEffect(() => {
    const selectableIds = new Set(selectableWinners.map((warband) => warband.id));
    setSelectedWinnerWarbandIds((prev) => prev.filter((warbandId) => selectableIds.has(warbandId)));
  }, [selectableWinners]);

  const toggleUser = (userId: number) => {
    const player = eligiblePlayerById[userId];
    if (userId === creatorUserId || player?.battle_busy) {
      return;
    }
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((entry) => entry !== userId) : [...prev, userId]
    );
  };

  const toggleWinner = (warbandId: number) => {
    setSelectedWinnerWarbandIds((prev) =>
      prev.includes(warbandId) ? prev.filter((entry) => entry !== warbandId) : [...prev, warbandId]
    );
  };

  const getBattleBusyLabel = (status: CampaignPlayer["battle_busy_status"]) => {
    if (status === "inviting") {
      return "In inviting battle";
    }
    if (status === "prebattle") {
      return "In prebattle";
    }
    if (status === "active") {
      return "In active battle";
    }
    if (status === "postbattle") {
      return "In postbattle";
    }
    return "In another battle";
  };

  const handleSubmit = async () => {
    if (mode === "report_result") {
      if (participantUserIds.length < 2) {
        setError("Select at least two players.");
        return;
      }
      if (selectedWinnerWarbandIds.length < 1) {
        setError("Select at least one winner.");
        return;
      }

      setIsSubmitting(true);
      setError("");
      try {
        await reportBattleResult(campaignId, {
          participant_user_ids: participantUserIds,
          winner_warband_ids: selectedWinnerWarbandIds,
        });
        onOpenChange(false);
        onBattleCreated?.();
      } catch (errorResponse) {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to report battle result");
        } else {
          setError("Unable to report battle result");
        }
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
      await createBattle(campaignId, {
        title: title.trim(),
        scenario: trimmedScenario,
        participant_user_ids: participantUserIds,
        participant_ratings: participantRatings,
        settings_json: {},
      });
      onOpenChange(false);
      onBattleCreated?.();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to create battle");
      } else {
        setError("Unable to create battle");
      }
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
    availablePlayers.length < 2 ||
    (mode === "start_battle"
      ? !scenario.trim()
      : participantUserIds.length < 2 || selectedWinnerWarbandIds.length < 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <TabSwitcher
            tabs={MODE_TABS}
            activeTab={mode}
            onTabChange={(nextMode) => {
              setMode(nextMode);
              setError("");
            }}
            className="mx-auto"
          />

          {mode === "start_battle" ? (
            <>
              <div className="space-y-2">
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                  Battle Title
                </p>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Skirmish in the ruins..."
                  maxLength={160}
                />
              </div>

              <div className="space-y-2">
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
                  Scenario
                </p>
                <Input
                  value={scenario}
                  onChange={(event) => setScenario(event.target.value)}
                  placeholder="Breakthrough at the Old Gate..."
                  maxLength={120}
                />
              </div>
            </>
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
                      mode === "start_battle" && player.battle_busy ? "opacity-60" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => toggleUser(player.id)}
                      disabled={player.id === creatorUserId || (mode === "start_battle" && Boolean(player.battle_busy))}
                    >
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {player.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {player.warband?.name ?? "No warband"}
                      </span>
                      {mode === "start_battle" && player.battle_busy ? (
                        <span className="block truncate text-[0.65rem] uppercase tracking-[0.15em] text-amber-300">
                          {getBattleBusyLabel(player.battle_busy_status)}
                        </span>
                      ) : null}
                    </button>
                    <div className="flex items-center gap-2">
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
                        disabled={player.id === creatorUserId || (mode === "start_battle" && Boolean(player.battle_busy))}
                        onChange={() => toggleUser(player.id)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

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
                          <p className="truncate text-sm font-semibold text-foreground">{warband.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{warband.faction}</p>
                        </div>
                        <Checkbox
                          checked={selectedWinnerWarbandIds.includes(warband.id)}
                          onChange={() => toggleWinner(warband.id)}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-black/20 px-3 py-2 text-sm text-muted-foreground">
                Participants:{" "}
                {selectedParticipants.length > 0
                  ? selectedParticipants.map((player) => player.warband?.name ?? player.name).join(", ")
                  : "-"}
                <br />
                Winners:{" "}
                {selectedWinnerWarbandIds.length > 0
                  ? selectableWinners
                      .filter((warband) => selectedWinnerWarbandIds.includes(warband.id))
                      .map((warband) => warband.name)
                      .join(", ")
                  : "-"}
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
