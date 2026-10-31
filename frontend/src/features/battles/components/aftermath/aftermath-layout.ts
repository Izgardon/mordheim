/**
 * The Aftermath's web layout, shared by the page and its loading skeleton: the step's cards, and
 * the battle's facts beside them on a wide screen (a hairline between the columns) or under them
 * (a hairline above).
 */
export const AFTERMATH_BODY = "grid items-start gap-8 min-[1280px]:grid-cols-[minmax(0,1fr)_320px]";
export const AFTERMATH_MAIN = "flex min-w-0 flex-col gap-3.5";
export const AFTERMATH_ASIDE =
  "flex min-w-0 flex-col gap-4 border-t border-line pt-8 min-[1280px]:border-l min-[1280px]:border-t-0 min-[1280px]:pl-8 min-[1280px]:pt-0";
