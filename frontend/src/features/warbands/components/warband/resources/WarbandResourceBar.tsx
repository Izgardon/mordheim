import { Button } from "@components/button";
import { CardBackground } from "@/components/ui/card-background";
import { Pencil } from "lucide-react";

import useWarbandResources, {
  type WarbandResourcesState,
} from "../../../hooks/warband/useWarbandResources";
import type { WarbandResource } from "../../../types/warband-types";
import ResourceRow, { type ResourceBarVariant } from "./ResourceRow";
import { ResourceAddForm, ResourceDeleteList } from "./ResourceEditControls";
import ResourceSellDialog from "./ResourceSellDialog";

type WarbandResourceBarProps = {
  warbandId: number;
  /** The sheet's resources; every write here updates the cached sheet they come from. */
  resources: WarbandResource[];
  canEdit: boolean;
  variant?: ResourceBarVariant;
};

/** The warband's resources (treasure, wyrdstone...): +/-, Sell, and adding or deleting them. */
export default function WarbandResourceBar({
  warbandId,
  resources = [],
  canEdit,
  variant = "card",
}: WarbandResourceBarProps) {
  const state = useWarbandResources({ warbandId, resources, canEdit });
  const { visibleResources, isEditingResources, toggleEditMode, resourceError } = state;

  const rows = visibleResources.map((resource) => (
    <ResourceRow
      key={resource.id}
      resource={resource}
      amount={state.getDisplayAmount(resource)}
      isUpdating={state.isResourceInFlight(resource.id)}
      canEdit={canEdit}
      variant={variant}
      onAdjust={state.handleAdjustResource}
      onSell={state.openSellDialog}
    />
  ));
  const addForm = (
    <ResourceAddForm
      variant={variant}
      name={state.newResourceName}
      onNameChange={state.setNewResourceName}
      isCreating={state.isCreatingResource}
      canEdit={canEdit}
      onAdd={state.handleAddResource}
    />
  );
  const deleteList =
    isEditingResources && visibleResources.length > 0 ? (
      <ResourceDeleteList
        variant={variant}
        resources={visibleResources}
        removingResourceId={state.removingResourceId}
        isResourceInFlight={state.isResourceInFlight}
        canEdit={canEdit}
        onRemove={state.handleRemoveResource}
      />
    ) : null;
  const error = resourceError ? <p className="text-xs text-red-500">{resourceError}</p> : null;

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
          {isEditingResources ? addForm : null}
          {!isEditingResources ? (
            <div className="grid grid-cols-2 gap-2">
              {visibleResources.length === 0 ? (
                <span className="col-span-2 text-xs font-semibold text-muted-foreground">
                  No resources yet.
                </span>
              ) : (
                rows
              )}
            </div>
          ) : null}
          {deleteList}
          {error}
        </div>
        <SellDialog state={state} />
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
              addForm
            ) : (
              <div className="flex flex-wrap items-start gap-6 px-4 py-2 sm:gap-8 sm:px-6 lg:gap-10 lg:px-8">
                {visibleResources.length === 0 ? (
                  <span className="text-xs font-semibold text-muted-foreground">
                    No resources yet.
                  </span>
                ) : (
                  rows
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
          {deleteList}
          {error}
        </div>
      </CardBackground>
      <SellDialog state={state} />
    </>
  );
}

/** The sale of the resource whose Sell was clicked. */
function SellDialog({ state }: { state: WarbandResourcesState }) {
  const { sellDialog, closeSellDialog, handleSellResource } = state;
  if (!sellDialog) {
    return null;
  }
  return (
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
  );
}
