import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listRestrictions } from "@/features/items/api/items-api";
import { CATALOGUE_STALE_TIME_MS } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";

import type { Restriction, RestrictionLink } from "@/features/items/types/item-types";

/** One restriction an entry names, with its note ("Any warband except Skaven" + "Undead only"). */
export type RestrictionRow = { key: number; restriction: Restriction; note: string };

const NO_RESTRICTIONS: Restriction[] = [];
let nextKey = 1;

const rowOf = (restriction: Restriction, note = ""): RestrictionRow => ({
  key: nextKey++,
  restriction,
  note,
});

/**
 * Who may hire an entry: its restrictions, each with a note, picked from the campaign's
 * restrictions (the book's and the campaign's, read once while the form is open). The same
 * restriction may be listed twice with different notes.
 */
export function useHirelingRestrictions({
  campaignId,
  enabled,
}: {
  campaignId: number;
  enabled: boolean;
}) {
  const [rows, setRows] = useState<RestrictionRow[]>([]);
  const { data } = useQuery({
    queryKey: queryKeys.campaign.restrictions(campaignId),
    queryFn: () => listRestrictions({ campaignId }),
    staleTime: CATALOGUE_STALE_TIME_MS,
    enabled: enabled && campaignId > 0,
  });

  const load = useCallback(
    (links: RestrictionLink[] | null) =>
      setRows((links ?? []).map((link) => rowOf(link.restriction, link.additional_note))),
    []
  );

  return {
    available: data ?? NO_RESTRICTIONS,
    rows,
    add: (restriction: Restriction) => setRows((prev) => [...prev, rowOf(restriction)]),
    remove: (key: number) => setRows((prev) => prev.filter((row) => row.key !== key)),
    setNote: (key: number, note: string) =>
      setRows((prev) => prev.map((row) => (row.key === key ? { ...row, note } : row))),
    load,
    /** The restrictions' part of a write body. */
    payload: () =>
      rows.map((row) => ({ restriction_id: row.restriction.id, additional_note: row.note.trim() })),
  };
}

export type HirelingRestrictions = ReturnType<typeof useHirelingRestrictions>;
