import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FinishBattleState } from "@/features/battles/hooks/useFinishBattle";
import type { BattleParticipant } from "@/features/battles/types/battle-types";

/** End Active Battle: pick the winning warbands, or No winner, and move everyone to postbattle. */
export default function ActiveFinishBattleDialog({
  finishing,
  participants,
}: {
  finishing: FinishBattleState;
  participants: BattleParticipant[];
}) {
  const { winnerWarbandIds, noWinner, isFinishing, error } = finishing;
  return (
    <Dialog open={finishing.isOpen} onOpenChange={finishing.setIsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>End Active Battle</DialogTitle>
          <DialogDescription className="block text-sm text-muted-foreground">
            Pick the winning warband or warbands, or No winner, then move everyone into postbattle.
            Wins and losses are recorded when everyone has finished postbattle.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {participants.map((participant) => (
            <label
              key={`winner-${participant.id}`}
              className="battle-inline-panel flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground"
            >
              <Checkbox
                checked={winnerWarbandIds.includes(participant.warband.id)}
                onChange={(event) =>
                  finishing.toggleWinner(participant.warband.id, event.target.checked)
                }
              />
              <span>{participant.warband.name}</span>
            </label>
          ))}
          <label className="battle-inline-panel flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground">
            <Checkbox
              checked={noWinner}
              onChange={(event) => finishing.toggleNoWinner(event.target.checked)}
            />
            <span>No winner</span>
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => finishing.setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void finishing.finish()}
            disabled={isFinishing || (winnerWarbandIds.length === 0 && !noWinner)}
          >
            {isFinishing ? "Ending..." : "End battle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
