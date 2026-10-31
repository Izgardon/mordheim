/**
 * The overview's web layout, shared by the page and its loading skeleton so they keep in step:
 * Standings and Battles in the main column, a hairline between them, and the Chronicle beside
 * them on a wide screen (a hairline between the columns) or under them (a hairline above).
 */
export const OVERVIEW_BODY = "grid items-start gap-8 min-[1280px]:grid-cols-[minmax(0,1fr)_380px]";
export const OVERVIEW_MAIN = "flex min-w-0 flex-col gap-8";
/** The main column's second section, under a hairline. */
export const OVERVIEW_DIVIDED = "border-t border-line pt-8";
export const OVERVIEW_ASIDE =
  "flex min-w-0 flex-col gap-7 border-t border-line pt-8 min-[1280px]:border-l min-[1280px]:border-t-0 min-[1280px]:pl-8 min-[1280px]:pt-0";
