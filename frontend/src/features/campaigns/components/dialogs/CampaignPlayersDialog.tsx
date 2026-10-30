import { useEffect, useState } from "react";

// components
import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/dialog";

// api
import { listCampaignPlayers } from "../../api/campaigns-api";

// types
import type { CampaignPlayer } from "../../types/campaign-types";
import { getErrorMessage } from "@/lib/get-error-message";

type CampaignPlayersDialogProps = {
  campaignId: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function CampaignPlayersDialog({
  campaignId,
  open: controlledOpen,
  onOpenChange,
}: CampaignPlayersDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [players, setPlayers] = useState<CampaignPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const open = controlledOpen ?? uncontrolledOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    setIsLoading(true);
    setError("");

    listCampaignPlayers(campaignId)
      .then((data) => setPlayers(data))
      .catch((errorResponse) => {
        setError(getErrorMessage(errorResponse, "Unable to load players"));
      })
      .finally(() => setIsLoading(false));
  }, [open, campaignId]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Roster
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[750px]">
        <DialogHeader>
          <DialogTitle className="font-bold">Roster</DialogTitle>
          <DialogDescription>Everyone playing in this campaign.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Gathering names...</p>
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No names logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {players.map((player) => (
              <li
                key={player.id}
                className="border border-border bg-surface px-3 py-2 text-sm text-ink"
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
