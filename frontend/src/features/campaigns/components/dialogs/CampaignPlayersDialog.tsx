import { useEffect, useState } from "react";

// components
import { Button } from "@components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@components/dialog";

// api
import { listCampaignPlayers } from "../../api/campaigns-api";

// types
import type { CampaignPlayer } from "../../types/campaign-types";

type CampaignPlayersDialogProps = {
  campaignId: number;
  campaignName: string;
};

export default function CampaignPlayersDialog({
  campaignId,
  campaignName,
}: CampaignPlayersDialogProps) {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<CampaignPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setIsLoading(true);
    setError("");

    listCampaignPlayers(campaignId)
      .then((data) => setPlayers(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load players");
        } else {
          setError("Unable to load players");
        }
      })
      .finally(() => setIsLoading(false));
  }, [open, campaignId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Roster
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogTitle className="font-bold" style={{ color: '#a78f79' }}>{campaignName} ROSTER</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Gathering names...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No names logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {players.map((player) => (
              <li
                key={player.id}
                className="rounded-2xl border border-border/60 bg-card/70 px-3 py-2 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.3)]"
              >
                {player.name}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}





