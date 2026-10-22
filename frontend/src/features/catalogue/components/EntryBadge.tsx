import type { KeyboardEvent, MouseEvent } from "react";

import { Tooltip } from "@components/tooltip";

import { bookLines, changedByLine, entrySource, ruleLabel } from "../utils/entry-status";
import type { CatalogueEntryLike } from "../types/catalogue-entry";

const LABEL_CLASS =
  "inline-flex items-center rounded border border-border/60 px-1 py-px text-[0.55rem] font-normal uppercase leading-none tracking-[0.12em] text-muted-foreground";

/** What the tooltip says: where the entry comes from, who changed it and when, the book's values. */
function badgeLines(entry: CatalogueEntryLike): string[] {
  const changed = changedByLine(entry);
  if (entrySource(entry) === "custom") {
    return ["Added for this campaign; not in the book.", ...(changed ? [changed] : [])];
  }
  const origin = entry.generated_effect_key
    ? `Set by ${ruleLabel(entry.generated_effect_key)}.`
    : `This campaign's version of the book's ${entry.book?.name ?? entry.name}.`;
  return [origin, ...(changed ? [changed] : []), ...(entry.book ? bookLines(entry.book) : [])];
}

/** Clicks and keys on the badge open its tooltip only, never the row or card around it. */
const keepInside = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

/**
 * A small "Custom" (the campaign's own entry) or "House rule" (the campaign's version of a book
 * entry) label beside an entry's name (CAT-NEW-03), and "Archived" when it is. Its tooltip opens on
 * hover, tap or keyboard focus (CAT-UX-06). The book's own entries carry none.
 */
export function EntryBadge({ entry }: { entry: CatalogueEntryLike }) {
  const source = entrySource(entry);
  if (source === "book" && !entry.archived_at) {
    return null;
  }
  const label = source === "custom" ? "Custom" : source === "version" ? "House rule" : null;
  return (
    <span
      className="ml-1.5 inline-flex gap-1 align-middle"
      onClick={keepInside}
      onKeyDown={keepInside}
    >
      {label ? (
        <Tooltip
          tabIndex={0}
          className="rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          trigger={<span className={LABEL_CLASS}>{label}</span>}
          content={
            <span className="block max-w-xs space-y-1 text-xs">
              {badgeLines(entry).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </span>
          }
          maxWidth={320}
        />
      ) : null}
      {entry.archived_at ? <span className={LABEL_CLASS}>Archived</span> : null}
    </span>
  );
}
