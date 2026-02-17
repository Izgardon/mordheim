import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createWarbandResource,
  createWarbandTrade,
  deleteWarbandResource,
  updateWarbandResource,
} from "../../api/warbands-api";

import type { WarbandResource } from "../../types/warband-types";

type UseWarbandResourcesOptions = {
  warbandId: number;
  resources: WarbandResource[];
  onResourcesUpdated: (resources: WarbandResource[]) => void;
  canEdit: boolean;
};

export default function useWarbandResources({
  warbandId,
  resources,
  onResourcesUpdated,
  canEdit,
}: UseWarbandResourcesOptions) {
  const [isEditingResources, setIsEditingResources] = useState(false);
  const [newResourceName, setNewResourceName] = useState("");
  const [resourceError, setResourceError] = useState("");
  const [isCreatingResource, setIsCreatingResource] = useState(false);
  const [pendingDeltas, setPendingDeltas] = useState<Record<number, number>>({});
  const [inFlightResources, setInFlightResources] = useState<Record<number, boolean>>({});
  const [removingResourceId, setRemovingResourceId] = useState<number | null>(null);
  const [sellDialog, setSellDialog] = useState<{
    resourceId: number;
    resourceName: string;
    maxQuantity: number;
  } | null>(null);

  const resourcesRef = useRef<WarbandResource[]>(resources);
  const pendingDeltasRef = useRef<Record<number, number>>({});
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const inFlightRef = useRef<Set<number>>(new Set());

  const visibleResources = useMemo(
    () => resources.filter((r) => r.name.trim().toLowerCase() !== "gold crowns"),
    [resources],
  );

  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  useEffect(() => {
    pendingDeltasRef.current = pendingDeltas;
  }, [pendingDeltas]);

  const updateInFlight = useCallback((resourceId: number, isInFlight: boolean) => {
    setInFlightResources((prev) => {
      const current = Boolean(prev[resourceId]);
      if (current === isInFlight) return prev;
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
      const existingTimer = timersRef.current[id];
      if (existingTimer) {
        clearTimeout(existingTimer);
        delete timersRef.current[id];
      }
      if (inFlightRef.current.has(id)) {
        updateInFlight(id, false);
      }
    });
  }, [resources, pendingDeltas, updateInFlight]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
      timersRef.current = {};
    };
  }, []);

  const clearPendingDelta = useCallback((resourceId: number) => {
    setPendingDeltas((prev) => {
      if (!prev[resourceId]) return prev;
      const next = { ...prev };
      delete next[resourceId];
      return next;
    });
    const existingTimer = timersRef.current[resourceId];
    if (existingTimer) {
      clearTimeout(existingTimer);
      delete timersRef.current[resourceId];
    }
  }, []);

  const flushResourceRef = useRef<(resourceId: number) => void>(() => undefined);

  const scheduleFlush = useCallback((resourceId: number) => {
    const existingTimer = timersRef.current[resourceId];
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    timersRef.current[resourceId] = setTimeout(() => {
      flushResourceRef.current(resourceId);
    }, 1000);
  }, []);

  flushResourceRef.current = async (resourceId: number) => {
    const pendingDelta = pendingDeltasRef.current[resourceId] ?? 0;
    if (!pendingDelta) return;
    if (inFlightRef.current.has(resourceId)) {
      scheduleFlush(resourceId);
      return;
    }
    const resource = resourcesRef.current.find((entry) => entry.id === resourceId);
    if (!resource) {
      clearPendingDelta(resourceId);
      return;
    }
    const baseAmount = Number(resource.amount ?? 0);
    const targetAmount = Math.max(0, baseAmount + pendingDelta);
    if (targetAmount === baseAmount) {
      clearPendingDelta(resourceId);
      return;
    }

    updateInFlight(resourceId, true);
    setResourceError("");
    try {
      const updated = await updateWarbandResource(
        warbandId,
        resourceId,
        { amount: targetAmount },
        { emitUpdate: false },
      );
      onResourcesUpdated(
        resourcesRef.current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      clearPendingDelta(resourceId);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setResourceError(errorResponse.message || "Unable to update resource.");
      } else {
        setResourceError("Unable to update resource.");
      }
      clearPendingDelta(resourceId);
    } finally {
      updateInFlight(resourceId, false);
    }
  };

  const handleAddResource = useCallback(async () => {
    const trimmed = newResourceName.trim();
    if (!trimmed) {
      setResourceError("Resource type is required.");
      return;
    }
    setIsCreatingResource(true);
    setResourceError("");
    try {
      const created = await createWarbandResource(
        warbandId,
        { name: trimmed },
        { emitUpdate: false },
      );
      onResourcesUpdated([...resources, created]);
      setNewResourceName("");
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setResourceError(errorResponse.message || "Unable to add resource.");
      } else {
        setResourceError("Unable to add resource.");
      }
    } finally {
      setIsCreatingResource(false);
    }
  }, [newResourceName, warbandId, resources, onResourcesUpdated]);

  const handleRemoveResource = useCallback(async (resourceId: number) => {
    setRemovingResourceId(resourceId);
    setResourceError("");
    clearPendingDelta(resourceId);
    try {
      await deleteWarbandResource(warbandId, resourceId, { emitUpdate: false });
      onResourcesUpdated(resources.filter((r) => r.id !== resourceId));
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setResourceError(errorResponse.message || "Unable to remove resource.");
      } else {
        setResourceError("Unable to remove resource.");
      }
    } finally {
      setRemovingResourceId(null);
    }
  }, [warbandId, resources, onResourcesUpdated, clearPendingDelta]);

  const handleAdjustResource = useCallback((resource: WarbandResource, delta: number) => {
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
      const existingTimer = timersRef.current[resource.id];
      if (existingTimer) {
        clearTimeout(existingTimer);
        delete timersRef.current[resource.id];
      }
      return;
    }
    scheduleFlush(resource.id);
  }, [canEdit, scheduleFlush]);

  const handleSellResource = useCallback(async (
    resourceId: number,
    quantity: number,
    price: number,
  ) => {
    const resource = resourcesRef.current.find((entry) => entry.id === resourceId);
    if (!resource) throw new Error("Resource not found.");
    const pendingDelta = pendingDeltasRef.current[resourceId] ?? 0;
    const currentAmount = Number(resource.amount ?? 0);
    const availableAmount = Math.max(0, currentAmount + pendingDelta);
    const sellQty = Math.max(0, Math.min(quantity, availableAmount));
    if (!sellQty) throw new Error("Sell quantity must be at least 1.");
    const targetAmount = Math.max(0, availableAmount - sellQty);

    clearPendingDelta(resourceId);
    updateInFlight(resourceId, true);
    setResourceError("");

    try {
      const updated = await updateWarbandResource(
        warbandId,
        resourceId,
        { amount: targetAmount },
        { emitUpdate: false },
      );
      onResourcesUpdated(
        resourcesRef.current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      await createWarbandTrade(warbandId, {
        action: "Sell",
        description: sellQty > 1 ? `${resource.name} x ${sellQty}` : resource.name,
        price,
      });
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setResourceError(errorResponse.message || "Unable to sell resource.");
      } else {
        setResourceError("Unable to sell resource.");
      }
      throw errorResponse;
    } finally {
      updateInFlight(resourceId, false);
    }
  }, [warbandId, onResourcesUpdated, clearPendingDelta, updateInFlight]);

  const toggleEditMode = useCallback(() => {
    setIsEditingResources((current) => !current);
    setResourceError("");
  }, []);

  const openSellDialog = useCallback((resourceId: number, resourceName: string, maxQuantity: number) => {
    setSellDialog({ resourceId, resourceName, maxQuantity });
  }, []);

  const closeSellDialog = useCallback(() => {
    setSellDialog(null);
  }, []);

  const getDisplayAmount = useCallback((resource: WarbandResource) => {
    const pendingDelta = pendingDeltas[resource.id] ?? 0;
    return Math.max(0, Number(resource.amount ?? 0) + pendingDelta);
  }, [pendingDeltas]);

  const isResourceInFlight = useCallback((resourceId: number) => {
    return Boolean(inFlightResources[resourceId]);
  }, [inFlightResources]);

  return {
    // resource lists
    visibleResources,

    // editing mode
    isEditingResources,
    toggleEditMode,
    newResourceName,
    setNewResourceName,
    isCreatingResource,
    removingResourceId,

    // sell dialog state
    sellDialog,
    openSellDialog,
    closeSellDialog,

    // error
    resourceError,

    // display helpers
    getDisplayAmount,
    isResourceInFlight,

    // actions
    handleAddResource,
    handleRemoveResource,
    handleAdjustResource,
    handleSellResource,
  };
}
