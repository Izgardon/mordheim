import { useCallback, useEffect, useState } from "react";

import { listWarbandItems } from "@/features/warbands/api/warbands-api";

import type { WarbandItemSummary } from "@/features/warbands/types/warband-types";

export function useWarbandWarchest(warbandId?: number | null) {
  const [isWarchestOpen, setIsWarchestOpen] = useState(false);
  const [warchestItems, setWarchestItems] = useState<WarbandItemSummary[]>([]);
  const [isWarchestLoading, setIsWarchestLoading] = useState(false);
  const [warchestError, setWarchestError] = useState("");

  const loadWarchestItems = useCallback(async () => {
    if (!warbandId) {
      return;
    }

    setIsWarchestLoading(true);
    setWarchestError("");
    try {
      const items = await listWarbandItems(warbandId);
      setWarchestItems(items);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setWarchestError(errorResponse.message || "Unable to load warchest items.");
      } else {
        setWarchestError("Unable to load warchest items.");
      }
    } finally {
      setIsWarchestLoading(false);
    }
  }, [warbandId]);

  useEffect(() => {
    if (isWarchestOpen) {
      loadWarchestItems();
    }
  }, [isWarchestOpen, loadWarchestItems]);

  const toggleWarchest = () => setIsWarchestOpen((prev) => !prev);
  const closeWarchest = () => setIsWarchestOpen(false);

  return {
    isWarchestOpen,
    setIsWarchestOpen,
    warchestItems,
    isWarchestLoading,
    warchestError,
    loadWarchestItems,
    toggleWarchest,
    closeWarchest,
  };
}
