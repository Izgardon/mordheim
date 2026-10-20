import { useState } from "react";

import { ApiError } from "./api-client";
import { apiErrorCode, getRefusalMessage } from "./get-error-message";

/** A 409 `in_use` body's `usage`: what still holds the entry (every key an integer). */
export type CatalogueUsage = {
  units?: number;
  warbands?: number;
  stashes?: number;
  bestiary_entries?: number;
};

const counted = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * The counts of a refused delete in one plain line, zero counts left out: "Used by 3 units in 2
 * warbands; nothing was deleted." Null when every count is zero.
 */
export function inUseMessage({
  units = 0,
  warbands = 0,
  stashes = 0,
  bestiary_entries: entries = 0,
}: CatalogueUsage): string | null {
  const held = [
    units > 0 ? counted(units, "unit", "units") : "",
    stashes > 0 ? counted(stashes, "stash", "stashes") : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const inWarbands =
    held && warbands > 0 ? `${held} in ${counted(warbands, "warband", "warbands")}` : held;
  const parts = [
    inWarbands,
    entries > 0 ? counted(entries, "bestiary entry", "bestiary entries") : "",
  ].filter(Boolean);
  return parts.length > 0 ? `Used by ${parts.join(", and by ")}; nothing was deleted.` : null;
}

/** Why a delete was refused: an entry in use gives its counts, anything else its own reason. */
export function deleteRefusalMessage(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError && apiErrorCode(caught) === "in_use") {
    const usage = (caught.data as { usage?: CatalogueUsage }).usage;
    const counts = usage ? inUseMessage(usage) : null;
    if (counts) {
      return counts;
    }
  }
  return getRefusalMessage(caught, fallback);
}

/**
 * The confirm behind a catalogue entry's Delete (BUG-148): when the server refuses, the confirm
 * stays open and says why, instead of writing it into the form the modal covers. An entry in use
 * (409 `in_use`) says what holds it and that nothing was deleted. Reopening starts clean.
 */
export function useCatalogueDeleteConfirm(fallback: string) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    setError("");
  };

  return {
    isOpen,
    error,
    onOpenChange,
    open: () => onOpenChange(true),
    close: () => onOpenChange(false),
    /** Before sending the DELETE: the last refusal no longer applies. */
    clearError: () => setError(""),
    /** What the DELETE rejected with; the confirm stays open and shows it. */
    refused: (caught: unknown) => setError(deleteRefusalMessage(caught, fallback)),
  };
}

export type CatalogueDeleteConfirmState = ReturnType<typeof useCatalogueDeleteConfirm>;
