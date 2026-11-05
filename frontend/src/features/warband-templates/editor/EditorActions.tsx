import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTemplate, revertTemplate } from "../api/editor-api";
import { templatesChanged } from "../api/editor-queries";
import { getRefusalMessage } from "@/lib/get-error-message";

import type { EditorAnswer } from "../types/editor-types";

type Pending = "revert" | "delete" | null;

/**
 * Revert (a house version goes back to the book's) and Delete (the campaign's own; a book
 * template is removed for this campaign), each asking first with what it loses. A template a
 * warband uses is archived rather than deleted (the server decides).
 */
export default function EditorActions({
  answer,
  campaignId,
  canDelete,
  onReverted,
  onDeleted,
}: {
  answer: EditorAnswer;
  campaignId: number;
  canDelete: boolean;
  /** The book template now in the version's place. */
  onReverted: (bookId: number) => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { template, facts } = answer;
  const warbands = facts.warbands
    ? ` ${facts.warbands === 1 ? "Its warband recruits" : `Its ${facts.warbands} warbands recruit`} by hand from then on.`
    : "";

  const act = async () => {
    setBusy(true);
    setError("");
    try {
      if (asking === "revert") {
        const book = await revertTemplate(template.id, campaignId);
        templatesChanged(queryClient, campaignId);
        onReverted(book.id);
      } else {
        await deleteTemplate(template, campaignId);
        templatesChanged(queryClient, campaignId);
        onDeleted();
      }
      setAsking(null);
    } catch (caught) {
      setError(getRefusalMessage(caught, "Unable to do that"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {facts.source === "house" ? (
          <Button size="sm" variant="secondary" onClick={() => setAsking("revert")}>
            Revert to book
          </Button>
        ) : null}
        {facts.source !== "house" && canDelete ? (
          <Button size="sm" variant="danger" onClick={() => setAsking("delete")}>
            {facts.source === "book" ? "Remove from campaign" : "Delete template"}
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => (open ? null : setAsking(null))}
        title={asking === "revert" ? "Revert to book" : "Delete template"}
        description={
          asking === "revert"
            ? `${template.name} goes back to the book's in this campaign: every change made here goes. Units already on rosters keep what they have.`
            : `${template.name} goes from this campaign.${warbands}`
        }
        confirmText={busy ? "Working..." : asking === "revert" ? "Revert" : "Delete"}
        confirmVariant={asking === "revert" ? "primary" : "danger"}
        isConfirming={busy}
        error={error}
        onConfirm={() => void act()}
      />
    </>
  );
}
