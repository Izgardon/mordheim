import type { MissingGamesFields } from "../types/warband-types";

/** How many more of the warband's battles a unit misses (0 while it fights). */
export const missingGamesOf = (unit: MissingGamesFields) => unit.missing_games ?? 0;

/** A unit out for games: the rating leaves it out, as the server's does. */
export const isMissing = (unit: MissingGamesFields) => missingGamesOf(unit) > 0;

/** A unit that isn't missing games: it counts towards the rating. */
export const fights = (unit: MissingGamesFields) => !isMissing(unit);

/** "1 game", "3 games". */
export const gamesText = (games: number) => `${games} game${games === 1 ? "" : "s"}`;

/** A saved unit's missing games and reason for its edit form. */
export const mapMissingToForm = (unit: MissingGamesFields) => ({
  missing_games: String(missingGamesOf(unit)),
  missing_reason: unit.missing_reason ?? "",
});

/**
 * What a Save sends for a saved unit's missing games: the count (blank reads as 0, which brings
 * the unit back) and the reason, or the count as typed when it isn't a whole number, so the
 * server's message lands on the card (UX-05). A queued recruit sends neither: only a unit already
 * on the roster misses games.
 */
export const buildMissingPayload = (
  form: { missing_games?: string; missing_reason?: string },
  isSessionCreated: boolean
): { missing_games?: number | string; missing_reason?: string } => {
  if (isSessionCreated || form.missing_games === undefined) {
    return {};
  }
  const typed = form.missing_games.trim();
  const games = typed === "" ? 0 : Number(typed);
  return {
    missing_games: Number.isInteger(games) ? games : typed,
    missing_reason: (form.missing_reason ?? "").trim(),
  };
};
