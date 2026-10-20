import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BattleParticipant } from "@/features/battles/types/battle-types";

type ClosePostbattleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participants: Pick<BattleParticipant, "id" | "status" | "user" | "warband">[];
  /** The signed-in user, shown as "you" in the list. */
  currentUserId?: number | null;
  /** End battle picked winners; with No winner nothing is recorded (decision 8). */
  hasWinners?: boolean;
  isClosing: boolean;
  error: string;
  onConfirm: () => void;
};

/**
 * Close postbattle (BUG-09, decision 3): ends the battle now. Says who hasn't finished, that they
 * are skipped with nothing applied, and that wins and losses are recorded.
 */
export default function ClosePostbattleDialog({
  open,
  onOpenChange,
  participants,
  currentUserId,
  hasWinners = true,
  isClosing,
  error,
  onConfirm,
}: ClosePostbattleDialogProps) {
  const unfinished = participants.filter((participant) => participant.status === "finished_battle");
  const ends = hasWinners
    ? "This ends the battle now and records wins and losses."
    : "This ends the battle now; with no winner, no wins or losses are recorded.";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Close postbattle</DialogTitle>
          <DialogDescription className="block text-sm text-muted-foreground">
            {unfinished.length > 0
              ? `${ends} These players haven't finished, so they are skipped: nothing from their postbattle is applied, and single-use items they used in the battle are still used up:`
              : `Everyone has finished. ${ends}`}
          </DialogDescription>
        </DialogHeader>
        {unfinished.length > 0 ? (
          <ul className="space-y-1 text-sm text-foreground">
            {unfinished.map((participant) => (
              <li key={participant.id}>
                {participant.user.id === currentUserId ? "You" : participant.user.label} (
                {participant.warband.name})
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isClosing}
          >
            Back
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isClosing}>
            {isClosing ? "Closing..." : "Close postbattle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
