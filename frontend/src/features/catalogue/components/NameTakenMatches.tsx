import { useState } from "react";

import { getRefusalMessage } from "@/lib/get-error-message";
import type { NameMatch } from "@/lib/field-errors";

import type { NameTakenState } from "../hooks/useNameTakenMatches";

const label = (match: NameMatch) => (match.type ? `${match.name} (${match.type})` : match.name);

/**
 * A match as its buttons name it for screen readers, with where it comes from, as its line says:
 * "the book Warhorse", "this campaign's Warhorse" (a book entry and its version share a name).
 */
const named = (match: NameMatch) =>
  `${match.source === "book" ? "the book" : "this campaign's"} ${label(match)}`;

const LINK_CLASS =
  "text-xs text-foreground underline underline-offset-2 hover:text-foreground/80 disabled:opacity-50";

/**
 * Under a taken name (CAT-TWEAK-02): every entry it collided with, where it comes from, and
 * "Edit this instead" (a book entry's edit makes the campaign's version) or, for an archived one,
 * Restore.
 */
export function NameTakenMatches({ id, nameTaken }: { id: string; nameTaken: NameTakenState }) {
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError] = useState("");
  if (nameTaken.matches.length === 0) {
    return null;
  }

  const restore = async (match: NameMatch) => {
    setRestoring(match.id);
    setError("");
    try {
      await nameTaken.onRestore(match);
    } catch (caught) {
      setError(getRefusalMessage(caught, `Couldn't restore ${match.name}.`));
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div id={id} className="mt-1 space-y-1">
      <ul aria-label="Entries with this name" className="space-y-1 text-xs text-muted-foreground">
        {nameTaken.matches.map((match) => (
          <li key={`${match.kind}-${match.id}`} className="flex flex-wrap items-center gap-x-2">
            <span>
              {label(match)} · {match.source === "book" ? "book" : "this campaign"}
              {match.archived ? " · archived" : ""}
            </span>
            {match.archived ? (
              <button
                type="button"
                className={LINK_CLASS}
                aria-label={`Restore ${named(match)}`}
                disabled={restoring !== null}
                onClick={() => void restore(match)}
              >
                {restoring === match.id ? "Restoring..." : "Restore"}
              </button>
            ) : nameTaken.onEdit ? (
              <button
                type="button"
                className={LINK_CLASS}
                aria-label={`Edit ${named(match)} instead`}
                onClick={() => nameTaken.onEdit?.(match)}
              >
                Edit this instead
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
