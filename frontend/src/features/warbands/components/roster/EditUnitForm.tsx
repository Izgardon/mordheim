import { useState } from "react";

import { NumberInput } from "@/components/ui/number-input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useDirtySince, useDiscardChanges } from "@/components/ui/discard-changes";
import { Input } from "@/components/ui/input";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { useMediaQuery } from "@/lib/use-media-query";

import EditNotes from "./edit/EditNotes";
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
 * sits at the bottom: Save, Cancel and Duplicate on the left, Notes, Missing games and Dismiss on
 * the right. Cancel or closing the sheet with changes unsaved asks "Discard changes?" first
 * (William: a form of more than 8 inputs).
 */
export default function EditUnitForm({
  entry,
  campaign,
  campaignId,
  warbandId,
  canCreateRace,
  onAddItem,
  onClose,
}: {
  entry: RosterUnit;
  campaign: CampaignSummary | null;
  campaignId: number;
  warbandId: number;
  canCreateRace: boolean;
  onAddItem: () => void;
  onClose: () => void;
}) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const form = useUnitEditDraft(entry, campaignId, warbandId);
  const { draft, lists, members, dismissed } = form;
  const changed = useDirtySince({ draft, lists, members, dismissed }).dirty;
  const discard = useDiscardChanges({ dirty: changed, onClose });
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const { saving } = form;
  const hasNotes = String(draft.notes ?? "").trim() !== "";
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
      {/* notes take no room until opened (William, 8 Nov 2026); the dot: he has some */}
      <Button variant="ghost" aria-expanded={notesOpen} onClick={() => setNotesOpen((o) => !o)}>
        Notes
        {hasNotes ? (
          <span className="h-1.5 w-1.5 shrink-0 bg-primary">
            <span className="sr-only">(written)</span>
          </span>
        ) : null}
      </Button>
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
        campaign={campaign}
        campaignId={campaignId}
        warbandId={warbandId}
        form={form}
        canCreateRace={canCreateRace}
        onAddItem={onAddItem}
      />
      {notesOpen ? <EditNotes form={form} onDone={() => setNotesOpen(false)} /> : null}
      {missingOpen ? <MissingGames form={form} onDone={() => setMissingOpen(false)} /> : null}
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet
        open
        onOpenChange={(open) => (open ? null : discard.close())}
        kicker="Edit"
        title={unitName(entry.unit)}
        footer={
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
            <Button variant="secondary" onClick={discard.close}>
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
        {discard.confirm}
      </BottomSheet>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {body}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Button disabled={saving} onClick={() => void form.save().then(done)}>
          Save
        </Button>
        <Button variant="ghost" onClick={discard.close}>
          Cancel
        </Button>
        {duplicate}
        {right}
      </div>
      {discard.confirm}
    </div>
  );
}
