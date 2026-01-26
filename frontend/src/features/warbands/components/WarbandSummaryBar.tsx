import { Button } from "../../../components/ui/button";

import type { WarbandResource } from "../types/warband-types";

type WarbandSummaryBarProps = {
  goldCrowns: number;
  rating: number;
  otherResources: WarbandResource[];
  saveMessage: string;
  saveError: string;
  canEdit: boolean;
  isEditing: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
};

export default function WarbandSummaryBar({
  goldCrowns,
  rating,
  otherResources,
  saveMessage,
  saveError,
  canEdit,
  isEditing,
  isSaving,
  onEdit,
  onSave,
  onCancel,
}: WarbandSummaryBarProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="rounded-md border border-border/70 bg-muted/30 px-2 py-1">
            Gold crowns <span className="text-foreground">{goldCrowns}</span>
          </span>
          <span className="rounded-md border border-border/70 bg-muted/30 px-2 py-1">
            Rating <span className="text-foreground">{rating}</span>
          </span>
          {otherResources.map((resource) => (
            <span
              key={resource.id}
              className="rounded-md border border-border/70 bg-muted/30 px-2 py-1"
            >
              {resource.name} <span className="text-foreground">{resource.amount}</span>
            </span>
          ))}
        </div>
        {saveMessage ? <p className="text-sm text-primary">{saveMessage}</p> : null}
        {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        {canEdit && !isEditing ? (
          <Button variant="outline" onClick={onEdit}>
            Edit warband
          </Button>
        ) : null}
        {canEdit && isEditing ? (
          <>
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
