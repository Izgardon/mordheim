import { useCallback, useEffect, useRef, useState } from "react";

import { useResourceChange } from "../../api/economy-queries";

import type { WarbandResource } from "../../types/warband-types";

/** How long +/- clicks gather before they are sent as one change. */
const FLUSH_DELAY_MS = 1000;

type UseResourceDeltasOptions = {
  warbandId: number;
  resources: WarbandResource[];
  canEdit: boolean;
  setResourceError: (message: string) => void;
};

/**
 * Resource +/-: clicks gather for a second per resource, then go out as one `delta` (BUG-68), one
 * request at a time per resource. The amount shown is the saved amount plus what is unsent.
 */
export function useResourceDeltas({
  warbandId,
  resources,
  canEdit,
  setResourceError,
}: UseResourceDeltasOptions) {
  const { mutateAsync: sendChange } = useResourceChange(warbandId);
  const [pendingDeltas, setPendingDeltas] = useState<Record<number, number>>({});
  const [inFlightResources, setInFlightResources] = useState<Record<number, boolean>>({});

  const resourcesRef = useRef<WarbandResource[]>(resources);
  const pendingDeltasRef = useRef<Record<number, number>>({});
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const inFlightRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  useEffect(() => {
    pendingDeltasRef.current = pendingDeltas;
  }, [pendingDeltas]);

  const updateInFlight = useCallback((resourceId: number, isInFlight: boolean) => {
    setInFlightResources((prev) => {
      if (Boolean(prev[resourceId]) === isInFlight) return prev;
      const next = { ...prev };
      if (isInFlight) {
        next[resourceId] = true;
      } else {
        delete next[resourceId];
      }
      return next;
    });
    if (isInFlight) {
      inFlightRef.current.add(resourceId);
    } else {
      inFlightRef.current.delete(resourceId);
    }
  }, []);

  const clearTimer = useCallback((resourceId: number) => {
    const existingTimer = timersRef.current[resourceId];
    if (existingTimer) {
      clearTimeout(existingTimer);
      delete timersRef.current[resourceId];
    }
  }, []);

  // Cleanup stale pending deltas when resources change
  useEffect(() => {
    const validIds = new Set(resources.map((r) => r.id));
    const next: Record<number, number> = {};
    const removedIds: number[] = [];
    Object.entries(pendingDeltas).forEach(([key, value]) => {
      const id = Number(key);
      if (validIds.has(id) && value) {
        next[id] = value;
      } else {
        removedIds.push(id);
      }
    });
    if (Object.keys(next).length !== Object.keys(pendingDeltas).length) {
      setPendingDeltas(next);
    }
    removedIds.forEach((id) => {
      clearTimer(id);
      if (inFlightRef.current.has(id)) {
        updateInFlight(id, false);
      }
    });
  }, [resources, pendingDeltas, updateInFlight, clearTimer]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
      timersRef.current = {};
    };
  }, []);

  const clearPendingDelta = useCallback(
    (resourceId: number) => {
      setPendingDeltas((prev) => {
        if (!prev[resourceId]) return prev;
        const next = { ...prev };
        delete next[resourceId];
        return next;
      });
      clearTimer(resourceId);
    },
    [clearTimer]
  );

  const flushResourceRef = useRef<(resourceId: number) => void>(() => undefined);

  const scheduleFlush = useCallback(
    (resourceId: number) => {
      clearTimer(resourceId);
      timersRef.current[resourceId] = setTimeout(() => {
        flushResourceRef.current(resourceId);
      }, FLUSH_DELAY_MS);
    },
    [clearTimer]
  );

  flushResourceRef.current = async (resourceId: number) => {
    const pendingDelta = pendingDeltasRef.current[resourceId] ?? 0;
    if (!pendingDelta) return;
    if (inFlightRef.current.has(resourceId)) {
      scheduleFlush(resourceId);
      return;
    }
    if (!resourcesRef.current.some((entry) => entry.id === resourceId)) {
      clearPendingDelta(resourceId);
      return;
    }
    updateInFlight(resourceId, true);
    setResourceError("");
    try {
      // The change, not an amount: a change another tab saved meanwhile is kept (BUG-68).
      await sendChange({ resourceId, delta: pendingDelta });
      clearPendingDelta(resourceId);
    } catch (errorResponse) {
      setResourceError(
        errorResponse instanceof Error
          ? errorResponse.message || "Unable to update resource."
          : "Unable to update resource."
      );
      clearPendingDelta(resourceId);
    } finally {
      updateInFlight(resourceId, false);
    }
  };

  const handleAdjustResource = useCallback(
    (resource: WarbandResource, delta: number) => {
      if (!canEdit) return;
      setResourceError("");
      const pendingDelta = pendingDeltasRef.current[resource.id] ?? 0;
      const currentAmount = Number(resource.amount ?? 0);
      const baseAmount = currentAmount + pendingDelta;
      const nextAmount = Math.max(0, baseAmount + delta);
      if (nextAmount === baseAmount) return;
      const nextDelta = nextAmount - currentAmount;
      setPendingDeltas((prev) => {
        const next = { ...prev };
        if (nextDelta === 0) {
          delete next[resource.id];
        } else {
          next[resource.id] = nextDelta;
        }
        return next;
      });
      if (nextDelta === 0) {
        clearTimer(resource.id);
        return;
      }
      scheduleFlush(resource.id);
    },
    [canEdit, clearTimer, scheduleFlush, setResourceError]
  );

  const getDisplayAmount = useCallback(
    (resource: WarbandResource) =>
      Math.max(0, Number(resource.amount ?? 0) + (pendingDeltas[resource.id] ?? 0)),
    [pendingDeltas]
  );

  const isResourceInFlight = useCallback(
    (resourceId: number) => Boolean(inFlightResources[resourceId]),
    [inFlightResources]
  );

  return {
    resourcesRef,
    pendingDeltasRef,
    clearPendingDelta,
    updateInFlight,
    sendChange,
    handleAdjustResource,
    getDisplayAmount,
    isResourceInFlight,
  };
}
