import type { MouseEvent } from "react";

import BeastItemButton from "../../units/beasts/BeastItemButton";

import type { BeastKind } from "@/features/bestiary/bestiary-kinds";

/** One stash row as the list shows it ("Sword x 3", "1 at 12 gc, 2 at 9 gc"). */
export type StashEntry = {
  id: string;
  visibleId: number;
  label: string;
  costs: string;
  beastKind: BeastKind | null;
};

/** Only the unit holding a mount or pet switches it on: in the stash, the row says so. */
const MOVE_FIRST: Partial<Record<BeastKind, string>> = {
  mount: "Move it to a unit to ride it",
  pet: "Move it to a unit to keep it as a pet",
};

type StashItemRowProps = {
  entry: StashEntry;
  canEdit: boolean;
  onMenuClick: (event: MouseEvent) => void;
  /** A creature's recruit button (none: no button). */
  onRecruit?: () => void;
};

/** A stash row: the item, its copies by cost, a beast's hint or recruit button, and its menu. */
export default function StashItemRow({
  entry,
  canEdit,
  onMenuClick,
  onRecruit,
}: StashItemRowProps) {
  const hint = entry.beastKind ? MOVE_FIRST[entry.beastKind] : undefined;
  return (
    <div className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 transition-colors duration-150 hover:border-white/40">
      <span className="min-w-0 flex-1 truncate text-foreground">
        {entry.label}
        {entry.costs ? (
          <span className="block truncate text-xs text-muted-foreground">{entry.costs}</span>
        ) : null}
        {hint ? <span className="block truncate text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      {canEdit && entry.beastKind === "creature" && onRecruit ? (
        <BeastItemButton kind="creature" on={false} itemLabel={entry.label} onClick={onRecruit} />
      ) : null}
      {canEdit ? (
        <button
          type="button"
          className="touch-target flex h-5 w-4 flex-shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-foreground/50 transition-colors duration-150 hover:text-foreground"
          onClick={onMenuClick}
          aria-label={`Actions for ${entry.label}`}
        >
          <svg width="3" height="13" viewBox="0 0 3 13" fill="currentColor" aria-hidden="true">
            <circle cx="1.5" cy="1.5" r="1.5" />
            <circle cx="1.5" cy="6.5" r="1.5" />
            <circle cx="1.5" cy="11.5" r="1.5" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
