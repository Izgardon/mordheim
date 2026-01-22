import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog";
import { useAuth } from "../../auth/hooks/use-auth";
import { listCampaignPlayers } from "../api/campaigns-api";
import type { CampaignPlayer } from "../types/campaign-types";

type CampaignPlayersDialogProps = {
  campaignId: number;
  campaignName: string;
};

export default function CampaignPlayersDialog({
  campaignId,
  campaignName,
}: CampaignPlayersDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<CampaignPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !token) {
      return;
    }

    setIsLoading(true);
    setError("");

    listCampaignPlayers(token, campaignId)
      .then((data) => setPlayers(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load players");
        } else {
          setError("Unable to load players");
        }
      })
      .finally(() => setIsLoading(false));
  }, [open, token, campaignId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Roster
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{campaignName} roster</DialogTitle>
          <DialogDescription>Names recorded for this campaign.</DialogDescription>
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
                className="rounded-md border-2 border-border/70 bg-card/70 px-3 py-2 text-sm text-foreground shadow-[2px_2px_0_rgba(23,16,8,0.15)]"
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
