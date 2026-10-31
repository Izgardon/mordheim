import type { MissingGamesFields } from "../types/warband-types";

/** How many more of the warband's battles a unit misses (0 while it fights). */
export const missingGamesOf = (unit: MissingGamesFields) => unit.missing_games ?? 0;

/** A unit out for games: the rating leaves it out, as the server's does. */
export const isMissing = (unit: MissingGamesFields) => missingGamesOf(unit) > 0;

/** A unit that isn't missing games: it counts towards the rating. */
export const fights = (unit: MissingGamesFields) => !isMissing(unit);
