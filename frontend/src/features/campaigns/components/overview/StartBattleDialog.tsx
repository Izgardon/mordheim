import { useEffect, useMemo, useRef, useState } from "react";

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
import { useMediaQuery } from "@/lib/use-media-query";
import { createBattle } from "@/features/battles/api/battles-api";
import type { CampaignPlayer } from "../../types/campaign-types";

type StartBattleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  creatorUserId: number;
  players: CampaignPlayer[];
  onBattleCreated?: () => void;
};

export default function StartBattleDialog({
  open,
  onOpenChange,
  campaignId,
  creatorUserId,
  players,
  onBattleCreated,
}: StartBattleDialogProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [scenario, setScenario] = useState("");
  const [title, setTitle] = useState("");
  const [ratingsByUserId, setRatingsByUserId] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isMobile = useMediaQuery("(max-width: 960px)");
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const focusTimerRef = useRef<number | null>(null);

  const eligiblePlayers = useMemo(
    () => players.filter((player) => player.warband?.id),
    [players]
  );
  const participantUserIds = useMemo(
    () => Array.from(new Set([...selectedUserIds, creatorUserId])),
    [creatorUserId, selectedUserIds]
  );

  useEffect(() => {
    if (!open && focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
  }, [open]);

  const handleOpenAutoFocus = (event: Event) => {
    if (!isMobile) {
      return;
    }
    event.preventDefault();
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
    }
    focusTimerRef.current = window.setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.scrollIntoView({ block: "center" });
    }, 320);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedUserIds([]);
    setError("");
    setScenario("");
    setTitle("");
    setRatingsByUserId(
      eligiblePlayers.reduce<Record<number, string>>((acc, player) => {
        const rating = player.warband?.rating;
        acc[player.id] = typeof rating === "number" ? String(Math.max(0, Math.round(rating))) : "";
        return acc;
      }, {})
    );
  }, [eligiblePlayers, open]);

  const toggleUser = (userId: number) => {
    if (userId === creatorUserId) {
      return;
    }
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((entry) => entry !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async () => {
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
      const rawRating = ratingsByUserId[userId]?.trim() ?? "";
      if (!rawRating) {
        participantRatings[String(userId)] = null;
        continue;
      }
      const parsed = Number(rawRating);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError("Ratings must be zero or greater.");
        return;
      }
      participantRatings[String(userId)] = Math.round(parsed);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px]" onOpenAutoFocus={handleOpenAutoFocus}>
        <DialogHeader>
          <DialogTitle>Start Battle</DialogTitle>
          <DialogDescription>
            Select participants, then proceed to prebattle setup.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
              Battle Title
            </p>
            <Input
              ref={titleInputRef}
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
                    className="grid cursor-pointer grid-cols-[1fr_auto] gap-3 rounded-lg border border-border/40 bg-black/30 px-3 py-2"
                  >
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => toggleUser(player.id)}
                    >
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {player.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {player.warband?.name ?? "No warband"}
                      </span>
                    </button>
                    <div className="flex items-center gap-2">
                      {player.id === creatorUserId ? (
                        <span className="text-[0.58rem] uppercase tracking-[0.15em] text-amber-300">
                          Creator
                        </span>
                      ) : null}
                      <span className="text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">
                        Rating
                      </span>
                      <Input
                        type="number"
                        min={0}
                        value={ratingsByUserId[player.id] ?? ""}
                        onChange={(event) =>
                          setRatingsByUserId((prev) => ({
                            ...prev,
                            [player.id]: event.target.value,
                          }))
                        }
                        className="h-9 w-20 px-2 text-center"
                        placeholder="Rating"
                      />
                      <Checkbox
                        checked={selectedUserIds.includes(player.id)}
                        disabled={player.id === creatorUserId}
                        onChange={() => toggleUser(player.id)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleCreate}
            disabled={isSubmitting || eligiblePlayers.length < 2 || !scenario.trim()}
          >
            {isSubmitting ? "Creating..." : "Create battle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
