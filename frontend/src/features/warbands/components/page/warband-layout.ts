/**
 * The warband page's layout, shared by the page and its loading skeleton: the stats line, the
 * resources and the plot stacked at the top of the Roster tab (William, 20 Nov 2026), and the
 * roster's sections (a hairline between them) with every unit in a grid, whose rows leave room for
 * the Advance ready badge on a card's top edge.
 */
export const WARBAND_INFO = "flex flex-col gap-4";
/** A heading over one of those sections (Resources, the plot's name). */
export const SECTION_TITLE = "m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
export const ROSTER_SECTIONS = "flex flex-col gap-[30px]";
/** A roster section after the first, under a hairline. */
export const ROSTER_DIVIDED = "border-t border-line pt-[30px]";
export const ROSTER_HEROES =
  "grid gap-x-3 gap-y-6 pt-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,380px),1fr))]";
