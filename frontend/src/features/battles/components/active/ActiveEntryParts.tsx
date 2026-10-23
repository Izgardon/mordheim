import type { UnitItemEntry } from "@/features/battles/components/prebattle/prebattle-types";

const NOTES_CLASS =
  "min-h-[8.5rem] max-h-[14rem] w-full resize-none overflow-y-auto rounded-md border border-border/60 bg-black/25 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-[#8b6a31] focus:ring-1 focus:ring-[#8b6a31]/50 read-only:cursor-default read-only:opacity-80";

/** The Notes tab's text box (500 characters). */
export function ActiveNotesBox({
  name,
  value,
  readOnly,
  onChange,
}: {
  name: string;
  value: string;
  readOnly: boolean;
  onChange: (notes: string) => void;
}) {
  return (
    <div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.currentTarget.value.slice(0, 500))}
        readOnly={readOnly}
        maxLength={500}
        placeholder="Add unit notes..."
        aria-label={`Notes for ${name}`}
        className={NOTES_CLASS}
      />
    </div>
  );
}

/** A single-use item's copies left, with Use and Undo for its player. */
export function ActiveSingleUseControls({
  item,
  remaining,
  canInteract,
  isUsingItem,
  onUse,
  onUndo,
}: {
  item: UnitItemEntry;
  remaining: number;
  canInteract: boolean;
  isUsingItem: boolean;
  onUse?: (item: UnitItemEntry) => Promise<void> | void;
  onUndo?: (itemId: number) => Promise<void> | void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="unit-list-entry-meta text-[0.58rem] uppercase tracking-[0.18em]">
        {remaining}/{item.count ?? 0}
      </span>
      {canInteract && onUse ? (
        <button
          type="button"
          className="battle-toolbar-button px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.16em] text-foreground disabled:opacity-50"
          onClick={() => {
            if (remaining <= 0 || isUsingItem) {
              return;
            }
            void onUse(item);
          }}
          disabled={remaining <= 0 || isUsingItem}
        >
          {isUsingItem ? "..." : "Use"}
        </button>
      ) : null}
      {canInteract && onUndo && remaining < item.count ? (
        <button
          type="button"
          className="battle-toolbar-button px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground disabled:opacity-50"
          onClick={() => void onUndo(item.id)}
          disabled={isUsingItem}
          aria-label={`Undo using ${item.name}`}
        >
          Undo
        </button>
      ) : null}
    </div>
  );
}
