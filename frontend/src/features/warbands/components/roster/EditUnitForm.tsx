import { useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useDirtySince, useDiscardChanges } from "@/components/ui/discard-changes";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { useMediaQuery } from "@/lib/use-media-query";

import { missingLabel } from "../../units/missing-games";
import EditNotes from "./edit/EditNotes";
import EditUnitFields from "./edit/EditUnitFields";
import MissingGamesFields from "./edit/MissingGamesFields";
import { useUnitEditDraft } from "./edit/useUnitEditDraft";
import { isGroup, unitName, type RosterUnit } from "./unit-view";

/**
 * One unit's edit form (design E): inline in its open card on the web, a bottom sheet on a
 * phone. Saved alone through the batch save; Duplicate and Dismiss go the same way. On the web
 * every action sits at the bottom: Save, Cancel and Duplicate on the left, Notes, Missing games
 * and Dismiss on the right (a group has none of its own: each member has his, by his row). On a
 * phone the sheet's own bar holds the three that act on the unit --
 * Dismiss, Duplicate and Save (William, 19 Nov 2026) -- leaving Notes and Missing games in the
 * body; there is no Cancel, because the sheet's X and a swipe already close it. Closing with
 * changes unsaved asks "Discard changes?" first (William: a form of more than 8 inputs).
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
  const dismiss = confirmDismiss ? (
    <Button
      variant="danger"
      className={isMobile ? "col-span-3" : undefined}
      disabled={saving}
      onClick={() => void form.dismiss().then(done)}
    >
      {dismissLabel} for good: carried items are lost
    </Button>
  ) : (
    <Button variant="ghost" className="text-danger" onClick={() => setConfirmDismiss(true)}>
      {dismissLabel}
    </Button>
  );
  const notesAndMissing = (
    <>
      {/* notes take no room until opened (William, 8 Nov 2026); the dot: he has some */}
      <Button variant="ghost" aria-expanded={notesOpen} onClick={() => setNotesOpen((o) => !o)}>
        Notes
        {hasNotes ? (
          <span className="h-1.5 w-1.5 shrink-0 bg-primary">
            <span className="sr-only">(written)</span>
          </span>
        ) : null}
      </Button>
      {isGroup(entry) ? null : (
        <Button
          variant="ghost"
          aria-expanded={missingOpen}
          onClick={() => setMissingOpen((o) => !o)}
        >
          {missing ? missingLabel(missing) : "Missing games"}
        </Button>
      )}
    </>
  );
  const right = (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      {notesAndMissing}
      {dismiss}
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
      {missingOpen ? (
        <MissingGamesFields
          games={String(draft.missing_games ?? "")}
          reason={String(draft.missing_reason ?? "")}
          onGames={(value) => form.set("missing_games", value)}
          onReason={(value) => form.set("missing_reason", value)}
          onDone={() => setMissingOpen(false)}
        />
      ) : null}
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
          // the three that act on the unit; confirming a dismissal takes the row and pushes the
          // other two down, so the loss is still said plainly and neither is lost
          <div className="grid grid-cols-3 gap-2">
            {dismiss}
            {duplicate}
            <Button
              className={confirmDismiss ? "col-span-2" : undefined}
              disabled={saving}
              onClick={() => void form.save().then(done)}
            >
              Save
            </Button>
          </div>
        }
      >
        {body}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {notesAndMissing}
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
