import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { missingGamesOffer } from "@/features/battles/components/postbattle/missing-games";
import PostbattleStepperInput from "@/features/battles/components/postbattle/PostbattleStepperInput";
import type { PostbattleRenderableRow } from "@/features/battles/components/postbattle/postbattle-utils";
import type { BattlePostbattleMissingGames } from "@/features/battles/types/battle-types";

type OfferProps = {
  row: PostbattleRenderableRow;
  disabled: boolean;
  onChange: (missing: BattlePostbattleMissingGames | null) => void;
};

const MAX_MISSING_GAMES = 99;

function Offer({
  row,
  offer,
  disabled,
  onChange,
}: OfferProps & { offer: NonNullable<ReturnType<typeof missingGamesOffer>> }) {
  const [picked, setPicked] = useState(row.missingGames?.games ?? offer.games);
  const ticked = Boolean(row.missingGames);
  const games = row.missingGames?.games ?? picked;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-foreground">
      <label className="flex items-center gap-2">
        <Checkbox
          checked={ticked}
          disabled={disabled}
          aria-label={`Set Missing games at finalise for ${row.unitName}`}
          onChange={(event) =>
            onChange(event.target.checked ? { games, reason: offer.reason } : null)
          }
        />
        <span>Set Missing games at finalise</span>
      </label>
      <label className="flex items-center gap-1">
        <PostbattleStepperInput
          value={games}
          min={1}
          max={MAX_MISSING_GAMES}
          disabled={disabled}
          onCommit={(next) => {
            setPicked(next);
            if (ticked && next !== games) onChange({ games: next, reason: offer.reason });
          }}
        />
        <span className="text-muted-foreground">
          {offer.dice ? `games (the book rolls ${offer.dice})` : "games"}
        </span>
      </label>
    </div>
  );
}

/**
 * The missing games a hero's or hired sword's last serious-injury roll offers (Deep Wound,
 * Captured...): opt-in, pre-filled with the table's number, set at finalise only when ticked.
 */
export default function PostbattleMissingGamesOffer(props: OfferProps) {
  const offer = missingGamesOffer(props.row);
  return offer ? <Offer {...props} offer={offer} /> : null;
}
