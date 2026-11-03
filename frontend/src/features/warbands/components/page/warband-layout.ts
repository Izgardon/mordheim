/**
 * The warband page's layout, shared by the page and its loading skeleton: the info line beside
 * the resources, and the roster's sections (a hairline between them) with heroes and hired swords
 * in a grid, whose rows leave room for the Advance ready badge on a card's top edge.
 */
export const WARBAND_INFO =
  "grid gap-x-8 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr))]";
export const ROSTER_SECTIONS = "flex flex-col gap-[30px]";
/** A roster section after the first, under a hairline. */
export const ROSTER_DIVIDED = "border-t border-line pt-[30px]";
export const ROSTER_HEROES =
  "grid gap-x-3 gap-y-6 pt-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,380px),1fr))]";
