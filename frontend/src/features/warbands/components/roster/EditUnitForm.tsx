import { useState } from "react";

import { NumberInput } from "@/components/ui/number-input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/lib/use-media-query";

import EditUnitFields from "./edit/EditUnitFields";
import { useUnitEditDraft, type UnitEditDraft } from "./edit/useUnitEditDraft";
import { isGroup, unitName, type RosterUnit } from "./unit-view";

const LABEL = "flex flex-col gap-1 text-xs font-bold text-muted-foreground";

/** Missing games, opened from its button: how many games and why, kept with the draft. */
function MissingGames({ form, onDone }: { form: UnitEditDraft; onDone: () => void }) {
  const { draft, set } = form;
  return (
    <div className="flex flex-wrap items-end gap-2 border border-border bg-raised p-2.5">
      <label className={LABEL}>
        Missing games
        <NumberInput
          compact
          inputSize="sm"
          className="w-24 font-mono"
          value={String(draft.missing_games ?? "")}
          onChange={(event) => set("missing_games", event.target.value)}
        />
      </label>
      <label className={`${LABEL} min-w-40 flex-1`}>
        Why
        <Input
          inputSize="sm"
          value={String(draft.missing_reason ?? "")}
          onChange={(event) => set("missing_reason", event.target.value)}
        />
      </label>
      <Button size="sm" variant="secondary" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

/**
 * One unit's edit form (design E): inline in its open card on the web, a bottom sheet on a
 * phone. Saved alone through the batch save; Duplicate and Dismiss go the same way. Every action
 * sits at the bottom: Save, Cancel and Duplicate on the left, Missing games and Dismiss on the
 * right.
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
  const [missingOpen, setMissingOpen] = useState(false);
  const { saving } = form;
  const dismissLabel = isGroup(entry)
    ? "Disband group"
    : entry.kind === "hireling"
      ? "Let go"
      : "Dismiss hero";
  const done = (saved: boolean) => (saved ? onClose() : undefined);
  const missing = Number(form.draft.missing_games) || 0;

  const duplicate = (
    <Button variant="secondary" disabled={saving} onClick={() => void form.duplicate().then(done)}>
      Duplicate
    </Button>
  );
  const right = (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <Button variant="ghost" aria-expanded={missingOpen} onClick={() => setMissingOpen((o) => !o)}>
        {missing ? `Missing · ${missing} ${missing === 1 ? "game" : "games"}` : "Missing games"}
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
  const body = (
    <>
      <EditUnitFields
        entry={entry}
        campaignId={campaignId}
        warbandId={warbandId}
        form={form}
        canCreateRace={canCreateRace}
        onAddItem={onAddItem}
      />
      {missingOpen ? <MissingGames form={form} onDone={() => setMissingOpen(false)} /> : null}
    </>
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
        {body}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {duplicate}
          {right}
        </div>
      </BottomSheet>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 border-t border-line pt-3">
      {body}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Button disabled={saving} onClick={() => void form.save().then(done)}>
          Save
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {duplicate}
        {right}
      </div>
    </div>
  );
}
