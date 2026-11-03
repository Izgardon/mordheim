import { useEffect, useRef, useState } from "react";

import {
  useCatalogueSearchParams,
  type SearchParamChanges,
} from "@/features/catalogue/hooks/useCatalogueSearchParams";

import { rowDomId } from "./ReferenceList";

/**
 * A reference page's state in the query string: the search (`q`), the open row (`open`) and the
 * page's own filters, so Search everything can link to a row and Back restores the page. On
 * arrival with a row open, it is scrolled into view once the list is `ready`; `reveal` opens a row
 * and scrolls to it the same way (the entry a form just saved).
 */
export function useReferenceParams(ready: boolean) {
  const url = useCatalogueSearchParams();
  const query = url.get("q");
  const openId = url.get("open") || null;
  // Only the row a link arrived with or `reveal` named is scrolled to, not one opened by a click.
  const linked = useRef(openId);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const target = linked.current;
    // a reveal's row is scrolled to once the query string has it open
    if (!ready || !target || target !== openId) return;
    linked.current = null;
    requestAnimationFrame(() => {
      document.getElementById(rowDomId(target))?.scrollIntoView({ block: "start" });
    });
  }, [ready, openId, revealed]);

  return {
    query,
    setQuery: (value: string) => url.set({ q: value }),
    openId,
    isOpen: (id: string) => openId === id,
    toggle: (id: string) => url.set({ open: openId === id ? null : id }),
    close: () => url.set({ open: null }),
    /** Opens the row `id` (with `changes` to the other params) and scrolls it into view. */
    reveal: (id: string, changes: SearchParamChanges = {}) => {
      linked.current = id;
      url.set({ ...changes, open: id });
      setRevealed((count) => count + 1);
    },
    get: url.get,
    set: url.set,
  };
}
