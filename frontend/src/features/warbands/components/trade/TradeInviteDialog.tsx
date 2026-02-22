import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { listCampaignPlayers } from "@/features/campaigns/api/campaigns-api";
import type { CampaignPlayer } from "@/features/campaigns/types/campaign-types";

type TradeInviteDialogProps = {
  campaignId: number;
  currentUserId?: number;
  trigger: React.ReactNode;
  onCreateTradeRequest: (targetUserId: number) => Promise<void>;
};

export default function TradeInviteDialog({
  campaignId,
  currentUserId,
  trigger,
  onCreateTradeRequest,
}: TradeInviteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [players, setPlayers] = useState<CampaignPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const loadPlayers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await listCampaignPlayers(campaignId);
      setPlayers(data);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to load campaign players.");
      } else {
        setError("Unable to load campaign players.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (isOpen) {
      loadPlayers();
    }
  }, [isOpen, loadPlayers]);

  const availablePlayers = useMemo(
    () => players.filter((player) => player.id !== currentUserId),
    [players, currentUserId]
  );

  const handleTradeRequest = async (player: CampaignPlayer) => {
    if (!player.id) {
      return;
    }
    setSubmittingId(player.id);
    try {
      await onCreateTradeRequest(player.id);
      setIsOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to start trade.");
      } else {
        setError("Unable to start trade.");
      }
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[34rem]">
        <DialogHeader className="items-start text-left">
          <DialogTitle>Start a Trade</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Here you can trade gold and items from your Warband Stash with other players, you can
          send along a Hero to do so which will use their trading action.
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading campaign players...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : availablePlayers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other players found.</p>
        ) : (
          <div className="space-y-2">
            {availablePlayers.map((player) => {
              const hasWarband = Boolean(player.warband);
              return (
                <button
                  key={player.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-[#2b2117]/80 bg-[#0f0c09] px-4 py-3 text-left text-sm text-foreground transition hover:border-[#5c4730]"
                  onClick={() => handleTradeRequest(player)}
                  disabled={!hasWarband || submittingId === player.id}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{player.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {player.warband?.name ?? "No warband"}
                    </span>
                  </div>
                  {submittingId === player.id ? (
                    <span className="text-xs text-muted-foreground">Sending...</span>
                  ) : (
                    <span className="text-xs uppercase tracking-[0.2em] text-[#c9b48a]">
                      Trade
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
