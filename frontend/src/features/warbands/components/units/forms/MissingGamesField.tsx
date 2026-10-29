import { useId } from "react";

import { Input } from "@components/input";
import { Label } from "@components/label";
import { NumberInput } from "@components/number-input";

type MissingGamesForm = { id?: number; missing_games?: string; missing_reason?: string };

type MissingGamesFieldProps<T extends MissingGamesForm> = {
  form: T;
  index: number;
  inputClassName: string;
  onUpdate: (index: number, updater: (form: T) => T) => void;
};

const MAX_MISSING_GAMES = 99;

/**
 * How many more battles a saved unit misses, and why (a serious injury, captured, ...). Each
 * battle the warband finalises counts one off; 0, or Clear, brings the unit back. A queued recruit
 * has none, so its card shows no field.
 */
export default function MissingGamesField<T extends MissingGamesForm>({
  form,
  index,
  inputClassName,
  onUpdate,
}: MissingGamesFieldProps<T>) {
  const gamesId = useId();
  const reasonId = useId();
  if (!form.id || form.missing_games === undefined) {
    return null;
  }
  const set = (patch: Partial<MissingGamesForm>) =>
    onUpdate(index, (current) => ({ ...current, ...patch }));
  const isSet = Number(form.missing_games.trim() || 0) > 0 || Boolean(form.missing_reason?.trim());

  return (
    <div className="space-y-2 rounded border border-border/60 bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={gamesId} className="text-sm font-semibold text-foreground">
          Missing games
        </Label>
        {isSet ? (
          <button
            type="button"
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => set({ missing_games: "0", missing_reason: "" })}
          >
            Clear
          </button>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
        <NumberInput
          id={gamesId}
          min={0}
          max={MAX_MISSING_GAMES}
          value={form.missing_games}
          onChange={(event) => set({ missing_games: event.target.value })}
          placeholder="0"
          className={inputClassName}
        />
        <Input
          id={reasonId}
          aria-label="Why the unit misses games"
          maxLength={120}
          value={form.missing_reason ?? ""}
          onChange={(event) => set({ missing_reason: event.target.value })}
          placeholder="Deep wound, captured..."
          className={inputClassName}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Each battle the warband finalises counts one game off; at 0 the unit is back.
      </p>
    </div>
  );
}
