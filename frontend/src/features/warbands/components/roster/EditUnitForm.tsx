import { useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/use-media-query";

import EditUnitFields from "./edit/EditUnitFields";
import { useUnitEditDraft } from "./edit/useUnitEditDraft";
import { isGroup, unitName, type RosterUnit } from "./unit-view";

/**
 * One unit's edit form (design E): inline in its open card on the web, a bottom sheet on a
 * phone. Saved alone through the batch save; Duplicate and Dismiss go the same way.
 */
export default function EditUnitForm({
  entry,
  campaignId,
  warbandId,
  canCreateRace,
  onAddItem,
  onClose,
}: {
  entry: RosterUnit;
  campaignId: number;
  warbandId: number;
  canCreateRace: boolean;
  onAddItem: () => void;
  onClose: () => void;
}) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const form = useUnitEditDraft(entry, campaignId, warbandId);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const { saving } = form;
  const dismissLabel = isGroup(entry)
    ? "Disband group"
    : entry.kind === "hireling"
      ? "Let go"
      : "Dismiss hero";
  const done = (saved: boolean) => (saved ? onClose() : undefined);

  const fields = (
    <EditUnitFields
      entry={entry}
      campaignId={campaignId}
      form={form}
      canCreateRace={canCreateRace}
      onAddItem={onAddItem}
    />
  );
  const extras = (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        disabled={saving}
        onClick={() => void form.duplicate().then(done)}
      >
        Duplicate
      </Button>
      {confirmDismiss ? (
        <Button variant="danger" disabled={saving} onClick={() => void form.dismiss().then(done)}>
          {dismissLabel} for good: carried items are lost
        </Button>
      ) : (
        <Button variant="ghost" className="text-danger" onClick={() => setConfirmDismiss(true)}>
          {dismissLabel}
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet
        open
        onOpenChange={(open) => (open ? null : onClose())}
        kicker="Edit"
        title={unitName(entry.unit)}
        footer={
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void form.save().then(done)}>
              Save changes
            </Button>
          </div>
        }
      >
        {fields}
        {extras}
      </BottomSheet>
    );
  }

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-3">
      {fields}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Button disabled={saving} onClick={() => void form.save().then(done)}>
          Save
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <div className="ml-auto">{extras}</div>
      </div>
    </div>
  );
}
