import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";
import { listCampaignPlayers } from "@/features/campaigns/api/campaigns-api";
import { getErrorMessage } from "@/lib/get-error-message";

/**
 * Trade with a player (the warband ⋯ menu): the campaign's other players with a warband, each
 * with Trade, which sends the invite; the trade opens once they accept it from their bell.
 */
export default function TradeInvitePanel({
  campaignId,
  userId,
  open,
  onOpenChange,
  onInvite,
}: {
  campaignId: number;
  userId: number | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (targetUserId: number) => Promise<void>;
}) {
  const players = useQuery({
    queryKey: ["campaign", campaignId, "players"],
    queryFn: () => listCampaignPlayers(campaignId),
    enabled: open,
  });
  const [sending, setSending] = useState<number | null>(null);
  const [error, setError] = useState("");
  const others = (players.data ?? []).filter((player) => player.id !== userId);

  const invite = async (playerId: number) => {
    setSending(playerId);
    setError("");
    try {
      await onInvite(playerId);
      onOpenChange(false);
    } catch (failure) {
      setError(getErrorMessage(failure, "Unable to start the trade."));
    } finally {
      setSending(null);
    }
  };

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} kicker="Warband" title="Trade with a player">
      <p className="m-0 text-sm text-text2">
        Trade gold and stash items with another player. Send a hero along and the trade uses his
        trading action.
      </p>
      {players.isPending ? (
        <p className="text-sm text-muted-foreground">Finding the players…</p>
      ) : null}
      {players.error ? (
        <p className="text-sm text-danger">{getErrorMessage(players.error)}</p>
      ) : null}
      {players.data && !others.length ? (
        <p className="text-sm text-text2">No other players yet.</p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <ul className="m-0 flex list-none flex-col border-t border-line p-0">
        {others.map((player) => (
          <li key={player.id} className="flex items-center gap-3 border-b border-line py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold text-ink">{player.name}</span>
              <span className="text-[13px] text-muted-foreground">
                {player.warband?.name ?? "No warband"}
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={!player.warband || sending !== null}
              onClick={() => void invite(player.id)}
            >
              {sending === player.id ? "Sending…" : "Trade"}
            </Button>
          </li>
        ))}
      </ul>
    </SidePanel>
  );
}
