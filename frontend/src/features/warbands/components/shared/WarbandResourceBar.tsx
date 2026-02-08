import { useEffect, useMemo, useRef, useState, useCallback } from "react";

import { Button } from "@components/button";
import { Input } from "@components/input";
import { CardBackground } from "@/components/ui/card-background";
import basicBar from "@/assets/containers/basic_bar.webp";
import numberBox from "@/assets/containers/number_box.webp";
import plusIcon from "@/assets/icons/Plus.webp";
import minusIcon from "@/assets/icons/Minus.webp";

import { createWarbandResource, deleteWarbandResource, updateWarbandResource } from "../../api/warbands-api";
import type { WarbandResource } from "../../types/warband-types";

type WarbandResourceBarProps = {
  warbandId: number;
  resources: WarbandResource[];
  onResourcesUpdated: (resources: WarbandResource[]) => void;
  canEdit: boolean;
};

export default function WarbandResourceBar({
  warbandId,
  resources = [],
  onResourcesUpdated,
  canEdit,
}: WarbandResourceBarProps) {
  const [isEditingResources, setIsEditingResources] = useState(false);
  const [newResourceName, setNewResourceName] = useState("");
  const [resourceError, setResourceError] = useState("");
  const [isCreatingResource, setIsCreatingResource] = useState(false);
  const [pendingDeltas, setPendingDeltas] = useState<Record<number, number>>({});
  const [inFlightResources, setInFlightResources] = useState<Record<number, boolean>>({});
  const [removingResourceId, setRemovingResourceId] = useState<number | null>(null);
  const resourcesRef = useRef<WarbandResource[]>(resources);
  const pendingDeltasRef = useRef<Record<number, number>>({});
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const inFlightRef = useRef<Set<number>>(new Set());

  const visibleResources = useMemo(
    () =>
      resources.filter(
        (resource) => resource.name.trim().toLowerCase() !== "gold crowns"
      ),
    [resources]
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
      if (current === isInFlight) {
        return prev;
      }
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

  useEffect(() => {
    const validIds = new Set(resources.map((resource) => resource.id));
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

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((timer) => clearTimeout(timer));
      timersRef.current = {};
    };
  }, []);

  const clearPendingDelta = useCallback((resourceId: number) => {
    setPendingDeltas((prev) => {
      if (!prev[resourceId]) {
        return prev;
      }
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
    if (!pendingDelta) {
      return;
    }
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
      const updated = await updateWarbandResource(warbandId, resourceId, {
        amount: targetAmount,
      });
      onResourcesUpdated(
        resourcesRef.current.map((entry) => (entry.id === updated.id ? updated : entry))
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

  const handleAddResource = async () => {
    const trimmed = newResourceName.trim();
    if (!trimmed) {
      setResourceError("Resource type is required.");
      return;
    }
    setIsCreatingResource(true);
    setResourceError("");
    try {
      const created = await createWarbandResource(warbandId, { name: trimmed });
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
  };

  const handleRemoveResource = async (resourceId: number) => {
    setRemovingResourceId(resourceId);
    setResourceError("");
    clearPendingDelta(resourceId);
    try {
      await deleteWarbandResource(warbandId, resourceId);
      onResourcesUpdated(resources.filter((resource) => resource.id !== resourceId));
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setResourceError(errorResponse.message || "Unable to remove resource.");
      } else {
        setResourceError("Unable to remove resource.");
      }
    } finally {
      setRemovingResourceId(null);
    }
  };

  const handleAdjustResource = async (resource: WarbandResource, delta: number) => {
    if (!canEdit) {
      return;
    }
    setResourceError("");
    const pendingDelta = pendingDeltasRef.current[resource.id] ?? 0;
    const currentAmount = Number(resource.amount ?? 0);
    const baseAmount = currentAmount + pendingDelta;
    const nextAmount = Math.max(0, baseAmount + delta);
    if (nextAmount === baseAmount) {
      return;
    }
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
  };

  return (
    <CardBackground
      className="warband-section-hover flex w-full flex-wrap items-start justify-between gap-3 px-4 py-2"
      style={{
        boxShadow: "0 32px 50px rgba(6, 3, 2, 0.55)",
        ["--dialog-title-top" as string]: "max(15px, 4%)",
      }}
      fallbackSrc={basicBar}
    >
      <div className="w-full space-y-2">
        <div className="flex w-full flex-wrap items-center gap-3">
          {isEditingResources ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={newResourceName}
                onChange={(event) => setNewResourceName(event.target.value)}
                placeholder="Resource type"
                className="h-9 w-48"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddResource}
                disabled={isCreatingResource || !canEdit}
              >
                {isCreatingResource ? "Adding..." : "Add resource"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-start gap-10 px-8 py-2">
              {visibleResources.length === 0 ? (
                <span className="text-xs font-semibold text-muted-foreground">
                  No resources yet.
                </span>
              ) : (
                visibleResources.map((resource) => {
                  const pendingDelta = pendingDeltas[resource.id] ?? 0;
                  const displayAmount = Math.max(0, Number(resource.amount ?? 0) + pendingDelta);
                  const isUpdating = Boolean(inFlightResources[resource.id]);
                  return (
                    <div
                      key={resource.id}
                      className="group flex flex-col items-center gap-1 px-4 py-2 text-xs font-semibold text-muted-foreground"
                    >
                      <span className="max-w-[7rem] truncate text-center uppercase tracking-wide">
                        {resource.name}
                      </span>
                      <div className="relative flex items-center justify-center">
                        <div
                          className="flex h-12 w-16 items-center justify-center text-base font-bold text-foreground"
                          style={{
                            backgroundImage: `url(${numberBox})`,
                            backgroundSize: "100% 100%",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                          }}
                        >
                          {displayAmount}
                        </div>
                        <button
                          type="button"
                          aria-label={`Decrease ${resource.name}`}
                          onClick={() => handleAdjustResource(resource, -1)}
                          disabled={isUpdating || !canEdit}
                          className="icon-button pointer-events-none absolute left-0 top-1/2 flex h-6 w-6 -translate-x-full -translate-y-1/2 items-center justify-center opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 disabled:cursor-not-allowed"
                        >
                          <img
                            src={minusIcon}
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-contain"
                          />
                        </button>
                        <button
                          type="button"
                          aria-label={`Increase ${resource.name}`}
                          onClick={() => handleAdjustResource(resource, 1)}
                          disabled={isUpdating || !canEdit}
                          className="icon-button pointer-events-none absolute right-0 top-1/2 flex h-6 w-6 translate-x-full -translate-y-1/2 items-center justify-center opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 disabled:cursor-not-allowed"
                        >
                          <img
                            src={plusIcon}
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-contain"
                          />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditingResources((current) => !current);
                setResourceError("");
              }}
              className="section-edit-actions ml-auto"
            >
              {isEditingResources ? "Done" : "Edit resources"}
            </Button>
          ) : null}
        </div>
        {isEditingResources && visibleResources.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {visibleResources.map((resource) => (
              <div
                key={resource.id}
                className="flex items-center gap-2 border border-border/60 bg-background/60 px-2 py-1"
              >
                <span>{resource.name}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRemoveResource(resource.id)}
                  disabled={
                    removingResourceId === resource.id ||
                    Boolean(inFlightResources[resource.id]) ||
                    !canEdit
                  }
                >
                  {removingResourceId === resource.id ? "Removing..." : "Delete"}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        {resourceError ? <p className="text-xs text-red-500">{resourceError}</p> : null}
      </div>
    </CardBackground>
  );
}

