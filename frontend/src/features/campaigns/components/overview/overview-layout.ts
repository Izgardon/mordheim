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

/**
 * An open battle row's groups (its moments, or the Battles page's record): a label column ("Turn
 * 2") beside each group's lines on the web, the label over them on a phone.
 */
export const battleGroups = (isMobile: boolean) =>
  isMobile
    ? "m-0 flex list-none flex-col px-3 pb-2.5"
    : "m-0 flex list-none flex-col pb-3.5 pl-[178px] pr-[18px] pt-1";
export const battleGroupRow = (isMobile: boolean) =>
  isMobile
    ? "flex flex-col gap-1 border-t border-line py-2"
    : "grid grid-cols-[64px_minmax(0,1fr)] gap-3 border-t border-line py-2";
