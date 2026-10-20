import { Checkbox } from "@/components/ui/checkbox";

import type { CampaignPlayer } from "../../types/campaign-types";

type Warband = NonNullable<CampaignPlayer["warband"]>;

type ReportResultFieldsProps = {
  participants: CampaignPlayer[];
  winners: Warband[];
  selectedWinnerIds: number[];
  onToggleWinner: (warbandId: number) => void;
  noWinner: boolean;
  onNoWinnerChange: (checked: boolean) => void;
  battleDate: string;
};

/** A reported result's winners (or No winner, decision 8) and a summary of what is sent. */
export default function ReportResultFields({
  participants,
  winners,
  selectedWinnerIds,
  onToggleWinner,
  noWinner,
  onNoWinnerChange,
  battleDate,
}: ReportResultFieldsProps) {
  const winnerNames = noWinner
    ? "No winner"
    : selectedWinnerIds.length > 0
      ? winners
          .filter((warband) => selectedWinnerIds.includes(warband.id))
          .map((warband) => warband.name)
          .join(", ")
      : "-";

  return (
    <>
      <div className="space-y-2">
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">Winners</p>
        <div className="space-y-2 rounded-xl border border-border/50 bg-black/30 p-3">
          {winners.length === 0 ? (
            <p className="text-sm text-muted-foreground">Select participants first.</p>
          ) : (
            winners.map((warband) => (
              <div
                key={warband.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-black/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{warband.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{warband.faction}</p>
                </div>
                <Checkbox
                  checked={selectedWinnerIds.includes(warband.id)}
                  onChange={() => onToggleWinner(warband.id)}
                />
              </div>
            ))
          )}
          {winners.length > 0 ? (
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-black/30 px-3 py-2 text-sm font-semibold text-foreground">
              No winner
              <Checkbox
                checked={noWinner}
                onChange={(event) => onNoWinnerChange(event.target.checked)}
              />
            </label>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-black/20 px-3 py-2 text-sm text-muted-foreground">
        Participants:{" "}
        {participants.length > 0
          ? participants.map((player) => player.warband?.name ?? player.name).join(", ")
          : "-"}
        <br />
        Winners: {winnerNames}
        <br />
        Date: {battleDate || "-"}
      </div>
    </>
  );
}
