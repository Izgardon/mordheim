import { useCallback, useMemo, useState } from "react";

import { useResourceCreate, useResourceDelete, useResourceSale } from "../../api/economy-queries";
import { useResourceDeltas } from "./useResourceDeltas";

import type { WarbandResource } from "../../types/warband-types";

type UseWarbandResourcesOptions = {
  warbandId: number;
  resources: WarbandResource[];
  canEdit: boolean;
};

type SellDialogState = { resourceId: number; resourceName: string; maxQuantity: number };

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message || fallback : fallback;

/**
 * The resource bar: +/- (`useResourceDeltas`), adding, deleting and selling resources, the edit
 * mode and the sell dialog. Each write puts its answer in the cached sheet the bar reads.
 */
export default function useWarbandResources({
  warbandId,
  resources,
  canEdit,
}: UseWarbandResourcesOptions) {
  const [isEditingResources, setIsEditingResources] = useState(false);
  const [newResourceName, setNewResourceName] = useState("");
  const [resourceError, setResourceError] = useState("");
  const [isCreatingResource, setIsCreatingResource] = useState(false);
  const [removingResourceId, setRemovingResourceId] = useState<number | null>(null);
  const [sellDialog, setSellDialog] = useState<SellDialogState | null>(null);
  const { mutateAsync: createResource } = useResourceCreate(warbandId);
  const { mutateAsync: deleteResource } = useResourceDelete(warbandId);
  const { mutateAsync: sellResource } = useResourceSale(warbandId);
  const deltas = useResourceDeltas({ warbandId, resources, canEdit, setResourceError });
  const { resourcesRef, pendingDeltasRef, clearPendingDelta, updateInFlight, sendChange } = deltas;

  const visibleResources = useMemo(
    () => resources.filter((r) => r.name.trim().toLowerCase() !== "gold crowns"),
    [resources]
  );

  const handleAddResource = useCallback(async () => {
    const trimmed = newResourceName.trim();
    if (!trimmed) {
      setResourceError("Resource type is required.");
      return;
    }
    setIsCreatingResource(true);
    setResourceError("");
    try {
      await createResource(trimmed);
      setNewResourceName("");
    } catch (errorResponse) {
      setResourceError(messageOf(errorResponse, "Unable to add resource."));
    } finally {
      setIsCreatingResource(false);
    }
  }, [createResource, newResourceName]);

  const handleRemoveResource = useCallback(
    async (resourceId: number) => {
      setRemovingResourceId(resourceId);
      setResourceError("");
      clearPendingDelta(resourceId);
      try {
        await deleteResource(resourceId);
      } catch (errorResponse) {
        setResourceError(messageOf(errorResponse, "Unable to remove resource."));
      } finally {
        setRemovingResourceId(null);
      }
    },
    [clearPendingDelta, deleteResource]
  );

  const handleSellResource = useCallback(
    async (resourceId: number, quantity: number, price: number) => {
      const resource = resourcesRef.current.find((entry) => entry.id === resourceId);
      if (!resource) throw new Error("Resource not found.");
      const pendingDelta = pendingDeltasRef.current[resourceId] ?? 0;
      const currentAmount = Number(resource.amount ?? 0);
      const availableAmount = Math.max(0, currentAmount + pendingDelta);
      const sellQty = Math.max(0, Math.min(quantity, availableAmount));
      if (!sellQty) throw new Error("Sell quantity must be at least 1.");

      clearPendingDelta(resourceId);
      updateInFlight(resourceId, true);
      setResourceError("");
      try {
        // Unsent clicks are saved first, so the sale counts them.
        if (pendingDelta) {
          await sendChange({ resourceId, delta: pendingDelta });
        }
        // One request writes the sale and its ledger row and answers the new gold (BUG-68).
        await sellResource({ resourceId, quantity: sellQty, price });
      } catch (errorResponse) {
        setResourceError(messageOf(errorResponse, "Unable to sell resource."));
        throw errorResponse;
      } finally {
        updateInFlight(resourceId, false);
      }
    },
    [clearPendingDelta, pendingDeltasRef, resourcesRef, sellResource, sendChange, updateInFlight]
  );

  const toggleEditMode = useCallback(() => {
    setIsEditingResources((current) => !current);
    setResourceError("");
  }, []);

  return {
    visibleResources,
    isEditingResources,
    toggleEditMode,
    newResourceName,
    setNewResourceName,
    isCreatingResource,
    removingResourceId,
    sellDialog,
    openSellDialog: (resourceId: number, resourceName: string, maxQuantity: number) =>
      setSellDialog({ resourceId, resourceName, maxQuantity }),
    closeSellDialog: () => setSellDialog(null),
    resourceError,
    getDisplayAmount: deltas.getDisplayAmount,
    isResourceInFlight: deltas.isResourceInFlight,
    handleAddResource,
    handleRemoveResource,
    handleAdjustResource: deltas.handleAdjustResource,
    handleSellResource,
  };
}

export type WarbandResourcesState = ReturnType<typeof useWarbandResources>;
