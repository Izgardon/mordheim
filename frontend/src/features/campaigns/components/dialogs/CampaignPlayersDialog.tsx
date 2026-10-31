import { useEffect, useState } from "react";

// components
import { Button } from "@components/button";
import { ModalSheet } from "@components/modal-sheet";

// api
import { listCampaignPlayers } from "../../api/campaigns-api";

// types
import type { CampaignPlayer } from "../../types/campaign-types";
import { getErrorMessage } from "@/lib/get-error-message";

type CampaignPlayersDialogProps = {
  campaignId: number;
  /** The kicker over the roster's title. */
  campaignName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** Roster: everyone in the campaign and his warband (design E), read when it opens. */
export default function CampaignPlayersDialog({
  campaignId,
  campaignName,
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
    <>
      <Button variant="secondary" size="sm" onClick={() => handleOpenChange(true)}>
        Roster
      </Button>
      <ModalSheet
        open={open}
        onOpenChange={handleOpenChange}
        kicker={campaignName}
        title="Roster"
        description="Everyone playing in this campaign."
        className="max-w-[520px]"
      >
        {isLoading ? (
          <p className="m-0 text-sm text-muted-foreground">Gathering names...</p>
        ) : error ? (
          <p role="alert" className="m-0 text-sm text-danger">
            {error}
          </p>
        ) : players.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">No names logged yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {players.map((player) => (
              <li
                key={player.id}
                className="flex flex-col gap-0.5 border-t border-line py-2.5 first:border-t-0 first:pt-0"
              >
                <span className="text-[15px] font-bold text-head">{player.name}</span>
                <span className="text-[13px] text-text2">
                  {player.warband
                    ? [player.warband.name, player.warband.faction].filter(Boolean).join(" · ")
                    : "No warband yet"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ModalSheet>
    </>
  );
}
