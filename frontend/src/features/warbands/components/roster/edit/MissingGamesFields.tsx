import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";

const LABEL = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";

/**
 * Missing games, opened from its button: how many games and why. A hero's or hired sword's, and
 * each henchman's in his group's form (William, 25 Nov 2026), read the same.
 */
export default function MissingGamesFields({
  games,
  reason,
  onGames,
  onReason,
  onDone,
  label,
}: {
  games: string;
  reason: string;
  onGames: (value: string) => void;
  onReason: (value: string) => void;
  onDone: () => void;
  /** Whose: a member's names him, so each row's boxes are told apart. */
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2 border border-border bg-raised p-2.5">
      <label className={LABEL}>
        Missing games
        <NumberInput
          compact
          inputSize="sm"
          className="w-24 font-mono"
          aria-label={label ? `${label}: missing games` : undefined}
          value={games}
          onChange={(event) => onGames(event.target.value)}
        />
      </label>
      <label className={`${LABEL} min-w-40 flex-1`}>
        Why
        <Input
          inputSize="sm"
          aria-label={label ? `${label}: why` : undefined}
          value={reason}
          onChange={(event) => onReason(event.target.value)}
        />
      </label>
      <Button size="sm" variant="secondary" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
