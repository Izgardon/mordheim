import { useMemo, useState } from "react";

import { Button } from "@components/button";
import { Input } from "@components/input";

import { createWarbandResource, deleteWarbandResource, updateWarbandResource } from "../api/warbands-api";
import type { WarbandResource } from "../types/warband-types";

type WarbandResourceBarProps = {
  warbandId: number;
  resources: WarbandResource[];
  onResourcesUpdated: (resources: WarbandResource[]) => void;
  saveMessage: string;
  saveError: string;
  canEdit: boolean;
};

export default function WarbandResourceBar({
  warbandId,
  resources = [],
  onResourcesUpdated,
  saveMessage,
  saveError,
  canEdit,
}: WarbandResourceBarProps) {
  const [isEditingResources, setIsEditingResources] = useState(false);
  const [newResourceName, setNewResourceName] = useState("");
  const [resourceError, setResourceError] = useState("");
  const [isCreatingResource, setIsCreatingResource] = useState(false);
  const [updatingResourceId, setUpdatingResourceId] = useState<number | null>(null);
  const [removingResourceId, setRemovingResourceId] = useState<number | null>(null);

  const visibleResources = useMemo(
    () =>
      resources.filter(
        (resource) => resource.name.trim().toLowerCase() !== "gold crowns"
      ),
    [resources]
  );

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
    if (updatingResourceId) {
      return;
    }
    const currentAmount = Number(resource.amount ?? 0);
    const nextAmount = Math.max(0, currentAmount + delta);
    if (nextAmount === currentAmount) {
      return;
    }
    setUpdatingResourceId(resource.id);
    setResourceError("");
    try {
      const updated = await updateWarbandResource(warbandId, resource.id, {
        amount: nextAmount,
      });
      onResourcesUpdated(
        resources.map((entry) => (entry.id === updated.id ? updated : entry))
      );
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setResourceError(errorResponse.message || "Unable to update resource.");
      } else {
        setResourceError("Unable to update resource.");
      }
    } finally {
      setUpdatingResourceId(null);
    }
  };

  return (
    <div className="flex w-full flex-wrap items-start justify-between gap-3">
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
                variant="secondary"
                size="sm"
                onClick={handleAddResource}
                disabled={isCreatingResource || !canEdit}
              >
                {isCreatingResource ? "Adding..." : "Add resource"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
              {visibleResources.length === 0 ? (
                <span className="text-xs text-muted-foreground">No resources yet.</span>
              ) : (
                visibleResources.map((resource) => (
                  <div
                    key={resource.id}
                    className="group flex items-center gap-2 border border-border/70 bg-muted/30 px-2 py-1"
                  >
                    <span>{resource.name}:</span>
                    <span className="text-foreground">{resource.amount}</span>
                    <div className="flex flex-col opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-[0.5rem]"
                        onClick={() => handleAdjustResource(resource, 1)}
                        disabled={updatingResourceId === resource.id || !canEdit}
                      >
                        ▲
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-[0.5rem]"
                        onClick={() => handleAdjustResource(resource, -1)}
                        disabled={updatingResourceId === resource.id || !canEdit}
                      >
                        ▼
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsEditingResources((current) => !current);
              setResourceError("");
            }}
            disabled={!canEdit}
            className="ml-auto"
          >
            {isEditingResources ? "Done" : "Edit resources"}
          </Button>
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
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveResource(resource.id)}
                  disabled={removingResourceId === resource.id || !canEdit}
                >
                  {removingResourceId === resource.id ? "Removing..." : "Delete"}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        {resourceError ? <p className="text-xs text-red-500">{resourceError}</p> : null}
        {saveMessage ? <p className="text-sm text-primary">{saveMessage}</p> : null}
        {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
      </div>
    </div>
  );
}

