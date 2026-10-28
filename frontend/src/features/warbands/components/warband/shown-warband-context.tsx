import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useQuery } from "@tanstack/react-query";

import { sheetWarband, warbandSheetQuery } from "../../api/warband-queries";
import { useAppStore } from "@/stores/app-store";

import type { WarbandSheet } from "../../types/warband-sheet";
import type { Warband } from "../../types/warband-types";

/** Which warband a page shows: the key of its sheet in the query cache. */
type ShownWarband = { campaignId: number; warbandId: number };

const ShownWarbandContext = createContext<ShownWarband | null>(null);

/** Set by the warband page, so the item actions inside it act on the warband on screen. */
export function ShownWarbandProvider({
  campaignId,
  warbandId,
  children,
}: PropsWithChildren<ShownWarband>) {
  const value = useMemo(() => ({ campaignId, warbandId }), [campaignId, warbandId]);
  return <ShownWarbandContext.Provider value={value}>{children}</ShownWarbandContext.Provider>;
}

/**
 * The warband that buying, giving and moving items act on (BUG-107). On a warband page it is the
 * warband on screen, read from the page's cached sheet (the warband merged with its summary: gold
 * and the units on the roster), whoever owns it. Elsewhere (the Items page) it is your own
 * warband, from the app store. Null when there is none.
 */
export function useActingWarband(): Warband | null {
  const shown = useContext(ShownWarbandContext);
  const { warband: mine } = useAppStore();
  const sheet = useQuery({
    ...warbandSheetQuery(shown?.campaignId ?? 0, shown?.warbandId ?? 0),
    // The page loads and refreshes its sheet; this only reads the cached copy.
    enabled: false,
    select: sheetWarband,
  });
  return shown ? (sheet.data ?? null) : mine;
}

/**
 * The cached sheet of the warband on screen, its units in the detail shape (a creature group's
 * beast, a unit's mount); undefined off a warband page. Only reads the page's cached copy.
 */
export function useShownSheet(): WarbandSheet | undefined {
  const shown = useContext(ShownWarbandContext);
  const sheet = useQuery({
    ...warbandSheetQuery(shown?.campaignId ?? 0, shown?.warbandId ?? 0),
    enabled: false,
  });
  return shown ? sheet.data : undefined;
}
