import { Button } from "@components/button";
import { Input } from "@components/input";
import { CardBackground } from "@/components/ui/card-background";
import basicBar from "@/assets/containers/basic_bar.webp";
import numberBox from "@/assets/containers/number_box.webp";
import plusIcon from "@/assets/icons/Plus.webp";
import minusIcon from "@/assets/icons/Minus.webp";
import editIcon from "@/assets/components/edit.webp";

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
            <h3 className="text-lg font-semibold uppercase tracking-[0.2em] text-[#d6c1a2]">
              Resources
            </h3>
            {canEdit ? (
              isEditingResources ? (
                <Button type="button" variant="outline" size="sm" onClick={toggleEditMode}>
                  Done
                </Button>
              ) : (
                <button
                  type="button"
                  aria-label="Edit resources"
                  onClick={toggleEditMode}
                  className="icon-button h-8 w-8 shrink-0 transition-[filter] hover:brightness-125"
                >
                  <img src={editIcon} alt="" className="h-full w-full object-contain" />
                </button>
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
            <div className="space-y-2">
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
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-black/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
                          {resource.name}
                        </p>
                        <p className="text-lg font-semibold text-foreground">{displayAmount}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Decrease ${resource.name}`}
                          onClick={() => handleAdjustResource(resource, -1)}
                          disabled={isUpdating || !canEdit}
                          className="icon-button flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-black/40 disabled:cursor-not-allowed"
                        >
                          <img src={minusIcon} alt="" aria-hidden="true" className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Increase ${resource.name}`}
                          onClick={() => handleAdjustResource(resource, 1)}
                          disabled={isUpdating || !canEdit}
                          className="icon-button flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-black/40 disabled:cursor-not-allowed"
                        >
                          <img src={plusIcon} alt="" aria-hidden="true" className="h-4 w-4" />
                        </button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => openSellDialog(resource.id, resource.name, displayAmount)}
                          disabled={!canEdit}
                        >
                          Sell
                        </Button>
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
        className={`warband-section-hover flex w-full flex-wrap items-start justify-between gap-3 px-4 py-2 ${isEditingResources ? "warband-section-editing" : ""}`}
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
