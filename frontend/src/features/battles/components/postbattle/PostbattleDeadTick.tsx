import { Checkbox } from "@/components/ui/checkbox";

type PostbattleDeadTickProps = {
  unitKey: string;
  unitKind: "hero" | "hired_sword" | "henchman";
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
};

/**
 * A unit's Dead tick. A dead unit's items are lost (pass 2 decision 7), so once ticked it says
 * what goes with him: a hero's or hired sword's carried items, or one of each of a henchmen
 * group's items.
 */
export default function PostbattleDeadTick({
  unitKey,
  unitKind,
  checked,
  disabled,
  onChange,
}: PostbattleDeadTickProps) {
  const noteId = `postbattle-dead-note-${unitKey}`;
  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex h-9 items-center gap-2 text-sm text-foreground">
        <Checkbox
          checked={checked}
          disabled={disabled}
          aria-describedby={checked ? noteId : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        Dead
      </label>
      {checked ? (
        <p id={noteId} className="max-w-[16rem] text-right text-xs text-amber-300">
          {unitKind === "henchman"
            ? "One of each of the group's items is lost with him; move them to the stash first to keep them."
            : "All carried items are lost; move them to the stash first to keep them."}
        </p>
      ) : null}
    </div>
  );
}
