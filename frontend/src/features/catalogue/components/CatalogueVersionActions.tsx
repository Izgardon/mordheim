import { Link } from "react-router-dom";

import { Button } from "@components/button";
import { ConfirmDialog } from "@components/confirm-dialog";

import { entrySource, ruleLabel } from "../utils/entry-status";
import type { CatalogueRevertState } from "../hooks/useCatalogueRevert";
import type { CatalogueEntryLike } from "../types/catalogue-entry";

/**
 * What Revert does, in the brief's words with the real values: "Every Axe in the campaign goes
 * back to the book (5 gc). Copies already bought keep what was paid." Prices are an item's only.
 */
export function revertMessage(entry: CatalogueEntryLike) {
  const name = entry.book?.name ?? entry.name;
  const price = entry.book?.price;
  return price != null
    ? `Every ${name} in the campaign goes back to the book (${price} gc). Copies already bought keep what was paid.`
    : `Every ${name} in the campaign goes back to the book.`;
}

/** Whether the form offers Revert: a hand-made version of a book entry (a rule's clone doesn't). */
export const canRevert = (entry: CatalogueEntryLike) =>
  entrySource(entry) === "version" && !entry.generated_effect_key;

/** The edit form's Revert button, beside Delete. */
export function RevertButton({
  revert,
  disabled,
}: {
  revert: CatalogueRevertState;
  disabled: boolean;
}) {
  return (
    <Button variant="secondary" size="sm" onClick={revert.open} disabled={disabled}>
      Revert to book
    </Button>
  );
}

/** Revert's confirm: what goes back, and a refusal kept in it (it stays open). */
export function RevertConfirm({
  revert,
  entry,
  onReverted,
}: {
  revert: CatalogueRevertState;
  entry: CatalogueEntryLike;
  /** The shell's step once the answer is cached (close or reset the form). */
  onReverted: () => void;
}) {
  return (
    <ConfirmDialog
      open={revert.isOpen}
      onOpenChange={revert.onOpenChange}
      title="Revert to book"
      description={revertMessage(entry)}
      error={revert.error}
      confirmText={revert.isReverting ? "Reverting..." : "Revert"}
      confirmVariant="default"
      isConfirming={revert.isReverting}
      onConfirm={() => void revert.revert(onReverted)}
    />
  );
}

/**
 * A house rule's clone in the edit form, in place of Revert: which rule set it, where to change
 * that rule, and that saving an edit detaches it from the rule (PR C's Calls).
 */
export function RuleVersionNote({
  effectKey,
  campaignId,
}: {
  effectKey: string;
  campaignId: number;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      Set by {ruleLabel(effectKey)} (
      <Link
        to={`/campaigns/${campaignId}/house-rules`}
        className="underline underline-offset-2 hover:text-foreground"
      >
        House Rules
      </Link>
      ). Saving changes here detaches it from the rule, which then leaves it alone.
    </p>
  );
}
