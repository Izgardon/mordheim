import { useEffect, useRef } from "react";

import { useCatalogueSearchParams } from "@/features/catalogue/hooks/useCatalogueSearchParams";

import { rowDomId } from "./ReferenceList";

/**
 * A reference page's state in the query string: the search (`q`), the open row (`open`) and the
 * page's own filters, so Search everything can link to a row and Back restores the page. On
 * arrival with a row open, it is scrolled into view once the list is `ready`.
 */
export function useReferenceParams(ready: boolean) {
  const url = useCatalogueSearchParams();
  const query = url.get("q");
  const openId = url.get("open") || null;
  // Only the row a link arrived with is scrolled to, not one opened here by a click.
  const linked = useRef(openId);

  useEffect(() => {
    const target = linked.current;
    if (!ready || !target) return;
    linked.current = null;
    requestAnimationFrame(() => {
      document.getElementById(rowDomId(target))?.scrollIntoView({ block: "start" });
    });
  }, [ready]);

  return {
    query,
    setQuery: (value: string) => url.set({ q: value }),
    openId,
    isOpen: (id: string) => openId === id,
    toggle: (id: string) => url.set({ open: openId === id ? null : id }),
    close: () => url.set({ open: null }),
    get: url.get,
    set: url.set,
  };
}

export type ReferenceParams = ReturnType<typeof useReferenceParams>;
