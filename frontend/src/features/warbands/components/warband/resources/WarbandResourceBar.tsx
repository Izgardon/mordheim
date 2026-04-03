import { Button } from "@components/button";
import { Input } from "@components/input";
import { CardBackground } from "@/components/ui/card-background";
import { Minus, Pencil, Plus } from "lucide-react";

import useWarbandResources from "../../../hooks/warband/useWarbandResources";
import type { WarbandResource } from "../../../types/warband-types";
import ResourceSellDialog from "./ResourceSellDialog";

type WarbandResourceBarProps = {
  warbandId: number;
  resources: WarbandResource[];
  onResourcesUpdated: (resources: WarbandResource[]) => void;
  canEdit: boolean;
  variant?: "card" | "plain";
};

export default function WarbandResourceBar({
  warbandId,
  resources = [],
  onResourcesUpdated,
  canEdit,
  variant = "card",
}: WarbandResourceBarProps) {
  const {
    visibleResources,
    isEditingResources,
    toggleEditMode,
    newResourceName,
    setNewResourceName,
    isCreatingResource,
    removingResourceId,
    sellDialog,
    openSellDialog,
    closeSellDialog,
    resourceError,
    getDisplayAmount,
    isResourceInFlight,
    handleAddResource,
    handleRemoveResource,
    handleAdjustResource,
    handleSellResource,
  } = useWarbandResources({ warbandId, resources, onResourcesUpdated, canEdit });

  if (variant === "plain") {
    return (
      <>
        <div className="space-y-3 px-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="theme-heading-soft text-lg font-semibold uppercase tracking-[0.2em]">
              Resources
            </h3>
            {canEdit ? (
              isEditingResources ? (
                <Button type="button" variant="outline" size="sm" onClick={toggleEditMode}>
                  Done
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="icon"
                  size="icon"
                  aria-label="Edit resources"
                  onClick={toggleEditMode}
                  className="h-9 w-9"
                >
                  <Pencil className="h-5 w-5" aria-hidden="true" />
                </Button>
              )
            ) : null}
          </div>
          {isEditingResources ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={newResourceName}
                onChange={(event) => setNewResourceName(event.target.value)}
                placeholder="Resource type"
                className="h-9 flex-1 min-w-[160px]"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddResource}
                disabled={isCreatingResource || !canEdit}
              >
                {isCreatingResource ? "Adding..." : "Add"}
              </Button>
            </div>
          ) : null}
          {!isEditingResources ? (
            <div className="grid grid-cols-2 gap-2">
              {visibleResources.length === 0 ? (
                <span className="col-span-2 text-xs font-semibold text-muted-foreground">
                  No resources yet.
                </span>
              ) : (
                visibleResources.map((resource) => {
                  const displayAmount = getDisplayAmount(resource);
                  const isUpdating = isResourceInFlight(resource.id);
                  return (
                    <div
                      key={resource.id}
                      className="flex h-full flex-col gap-2 rounded-lg border border-border/60 bg-[rgba(18,14,10,0.78)] px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
                          {resource.name}
                        </p>
                      </div>
                      <div className="mt-auto flex min-w-0 items-center justify-between gap-1.5">
                        <p className="text-base font-semibold text-foreground">{displayAmount}</p>
                        <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="icon"
                            size="icon"
                            aria-label={`Decrease ${resource.name}`}
                            onClick={() => handleAdjustResource(resource, -1)}
                            disabled={isUpdating || !canEdit}
                            className="h-7 w-7 rounded-full disabled:cursor-not-allowed"
                          >
                            <Minus aria-hidden="true" className="theme-accent h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="icon"
                            size="icon"
                            aria-label={`Increase ${resource.name}`}
                            onClick={() => handleAdjustResource(resource, 1)}
                            disabled={isUpdating || !canEdit}
                            className="h-7 w-7 rounded-full disabled:cursor-not-allowed"
                          >
                            <Plus aria-hidden="true" className="theme-accent h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => openSellDialog(resource.id, resource.name, displayAmount)}
                            disabled={!canEdit}
                            className="h-7 px-2 text-[0.625rem]"
                          >
                            Sell
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
          {isEditingResources && visibleResources.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {visibleResources.map((resource) => (
                <div
                  key={resource.id}
                  className="flex items-center gap-2 rounded border border-border/60 bg-background/60 px-2 py-1"
                >
                  <span>{resource.name}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRemoveResource(resource.id)}
                    disabled={
                      removingResourceId === resource.id ||
                      isResourceInFlight(resource.id) ||
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
        {sellDialog ? (
          <ResourceSellDialog
            open
            onOpenChange={(open) => {
              if (!open) {
                closeSellDialog();
              }
            }}
            resourceName={sellDialog.resourceName}
            maxQuantity={sellDialog.maxQuantity}
            errorMessage="Unable to sell resource."
            onConfirm={({ quantity, price }) =>
              handleSellResource(sellDialog.resourceId, quantity, price)
            }
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <CardBackground
        className={`surface-panel-strong warband-section-hover flex w-full flex-wrap items-start justify-between gap-3 px-4 py-2 ${isEditingResources ? "warband-section-editing" : ""}`}
        style={{
          boxShadow: "var(--shadow-modal)",
          ["--dialog-title-top" as string]: "max(15px, 4%)",
        }}
      >
        <div className="w-full space-y-2">
          <div className="flex w-full flex-wrap items-center gap-3">
            {isEditingResources ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={newResourceName}
                  onChange={(event) => setNewResourceName(event.target.value)}
                  placeholder="Resource type"
                  className="h-8 w-48"
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
              <div className="flex flex-wrap items-start gap-6 px-4 py-2 sm:gap-8 sm:px-6 lg:gap-10 lg:px-8">
                {visibleResources.length === 0 ? (
                  <span className="text-xs font-semibold text-muted-foreground">
                    No resources yet.
                  </span>
                ) : (
                  visibleResources.map((resource) => {
                    const displayAmount = getDisplayAmount(resource);
                    const isUpdating = isResourceInFlight(resource.id);
                    return (
                      <div
                        key={resource.id}
                        className="group relative flex flex-col items-center gap-1 px-4 py-2 text-xs font-semibold text-muted-foreground"
                      >
                        <span className="max-w-[7rem] truncate text-center uppercase tracking-wide">
                          {resource.name}
                        </span>
                      <div className="relative flex items-center justify-center">
                        <div
                          className="surface-inline flex h-12 w-16 items-center justify-center rounded-lg text-base font-bold text-foreground"
                        >
                          {displayAmount}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            openSellDialog(resource.id, resource.name, displayAmount)
                          }
                          disabled={!canEdit}
                          className="pointer-events-none absolute left-1/2 top-full mt-0 h-7 -translate-x-1/2 px-3 text-[0.55rem] opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                        >
                          Sell
                        </Button>
                        <Button
                          type="button"
                          variant="icon"
                          size="icon"
                          aria-label={`Decrease ${resource.name}`}
                          onClick={() => handleAdjustResource(resource, -1)}
                          disabled={isUpdating || !canEdit}
                          className="pointer-events-none absolute left-0 top-1/2 h-6 w-6 -translate-x-full -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 disabled:cursor-not-allowed"
                          >
                            <Minus aria-hidden="true" className="theme-accent h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="icon"
                            size="icon"
                            aria-label={`Increase ${resource.name}`}
                            onClick={() => handleAdjustResource(resource, 1)}
                            disabled={isUpdating || !canEdit}
                            className="pointer-events-none absolute right-0 top-1/2 h-6 w-6 translate-x-full -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 disabled:cursor-not-allowed"
                          >
                            <Plus aria-hidden="true" className="theme-accent h-4 w-4" />
                          </Button>
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
                onClick={toggleEditMode}
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
                      isResourceInFlight(resource.id) ||
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
      {sellDialog ? (
        <ResourceSellDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              closeSellDialog();
            }
          }}
          resourceName={sellDialog.resourceName}
          maxQuantity={sellDialog.maxQuantity}
          errorMessage="Unable to sell resource."
          onConfirm={({ quantity, price }) =>
            handleSellResource(sellDialog.resourceId, quantity, price)
          }
        />
      ) : null}
    </>
  );
}
