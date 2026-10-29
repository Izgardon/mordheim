import type { KeyboardEvent, MouseEvent } from "react";

import { Tooltip } from "@components/tooltip";

import { gamesText, missingGamesOf } from "../../units/missing-games";
import type { MissingGamesFields } from "../../types/warband-types";

const BADGE_CLASS =
  "inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-amber-200";

/** Clicks and keys on the badge open its tooltip only, never the card around it. */
const keepInside = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

/**
 * "Missing · 2 games" on a unit's card while it misses games, with why in its tooltip (on hover,
 * tap or keyboard focus). Nothing while the unit fights.
 */
export default function MissingGamesBadge({
  unit,
  className,
}: {
  unit: MissingGamesFields;
  className?: string;
}) {
  const games = missingGamesOf(unit);
  if (games <= 0) {
    return null;
  }
  const reason = unit.missing_reason?.trim();
  const next = games === 1 ? "next game" : `next ${games} games`;
  return (
    <div className={className} onClick={keepInside} onKeyDown={keepInside}>
      <Tooltip
        tabIndex={0}
        className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        trigger={<span className={BADGE_CLASS}>{`Missing · ${gamesText(games)}`}</span>}
        content={
          <span className="block max-w-xs space-y-1 text-xs">
            <span className="block">{`Misses the warband's ${next}${reason ? `: ${reason}` : ""}.`}</span>
            <span className="block text-muted-foreground">
              Each battle the warband finalises counts one game off.
            </span>
          </span>
        }
        maxWidth={320}
      />
    </div>
  );
}
