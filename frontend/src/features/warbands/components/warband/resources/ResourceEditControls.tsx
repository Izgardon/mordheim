import { Button } from "@components/button";
import { Input } from "@components/input";

import type { ResourceBarVariant } from "./ResourceRow";
import type { WarbandResource } from "../../../types/warband-types";

type ResourceAddFormProps = {
  variant: ResourceBarVariant;
  name: string;
  onNameChange: (name: string) => void;
  isCreating: boolean;
  canEdit: boolean;
  onAdd: () => void;
};

/** A name for a new resource, and Add. */
export function ResourceAddForm({
  variant,
  name,
  onNameChange,
  isCreating,
  canEdit,
  onAdd,
}: ResourceAddFormProps) {
  const isPlain = variant === "plain";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="Resource type"
        className={isPlain ? "h-9 flex-1 min-w-[160px]" : "h-8 w-48"}
      />
      <Button type="button" size="sm" onClick={onAdd} disabled={isCreating || !canEdit}>
        {isCreating ? "Adding..." : isPlain ? "Add" : "Add resource"}
      </Button>
    </div>
  );
}

type ResourceDeleteListProps = {
  variant: ResourceBarVariant;
  resources: WarbandResource[];
  removingResourceId: number | null;
  isResourceInFlight: (resourceId: number) => boolean;
  canEdit: boolean;
  onRemove: (resourceId: number) => void;
};

/** Each resource with Delete, in edit mode (no confirmation yet: ECON-UX-03, PR C). */
export function ResourceDeleteList({
  variant,
  resources,
  removingResourceId,
  isResourceInFlight,
  canEdit,
  onRemove,
}: ResourceDeleteListProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {resources.map((resource) => (
        <div
          key={resource.id}
          className={`flex items-center gap-2 ${variant === "plain" ? "rounded " : ""}border border-border/60 bg-background/60 px-2 py-1`}
        >
          <span>{resource.name}</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onRemove(resource.id)}
            disabled={
              removingResourceId === resource.id || isResourceInFlight(resource.id) || !canEdit
            }
          >
            {removingResourceId === resource.id ? "Removing..." : "Delete"}
          </Button>
        </div>
      ))}
    </div>
  );
}
