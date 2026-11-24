import { useEffect, useState } from "react";

import { rowDomId } from "@/features/reference/ReferenceList";

import { filterGroups } from "../encampment-filter";
import type { EncampmentGroup } from "../types";

/** A set of ids with one toggled. */
const toggled = (ids: ReadonlySet<number>, id: number) => {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/**
 * The page's search and which rows are open. A search opens every group it leaves; `openId` (the
 * warband sheet's link, `?open=`) opens that encampment and its group once the list is read, and
 * scrolls to it.
 */
export function useEncampmentTree(groups: EncampmentGroup[], openId: number | null) {
  const [search, setSearch] = useState("");
  const [openGroups, setOpenGroups] = useState<ReadonlySet<number>>(() => new Set());
  const [openCamps, setOpenCamps] = useState<ReadonlySet<number>>(() => new Set());
  const shown = filterGroups(groups, search);
  const found = search.trim() ? shown.map((group) => group.id).join(",") : "";
  const linked = openId
    ? (groups.find((group) => group.encampments.some((camp) => camp.id === openId))?.id ?? null)
    : null;
  useEffect(() => {
    if (found) setOpenGroups(new Set(found.split(",").map(Number)));
  }, [found]);
  useEffect(() => {
    if (!openId || !linked) return;
    setOpenGroups((ids) => new Set([...ids, linked]));
    setOpenCamps((ids) => new Set([...ids, openId]));
    const timer = window.setTimeout(() => {
      document.getElementById(rowDomId(`e${openId}`))?.scrollIntoView?.({ block: "start" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [openId, linked]);
  return {
    search,
    setSearch,
    shown,
    groupOpen: (id: number) => openGroups.has(id),
    toggleGroup: (id: number) => setOpenGroups((ids) => toggled(ids, id)),
    campOpen: (id: number) => openCamps.has(id),
    toggleCamp: (id: number) => setOpenCamps((ids) => toggled(ids, id)),
  };
}
