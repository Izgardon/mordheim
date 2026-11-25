import { SearchSelect } from "@/components/ui/search-select";
import type { BestiaryEntrySummary } from "@/features/bestiary/types/bestiary-types";
import { beastOption } from "@/features/catalogue/search-options";

/**
 * A creature from the bestiary on the app's searchable select (William, 12 Nov 2026: it should
 * read as one picker), or, with `typed`, a type it doesn't hold, used as typed.
 */
export default function CreaturePicker({
  label,
  bestiary,
  beast,
  typed,
  onPick,
}: {
  label: string;
  bestiary: BestiaryEntrySummary[];
  beast: BestiaryEntrySummary | undefined;
  /** What was typed in, and where it goes; left out, only the bestiary's creatures are offered. */
  typed?: { value: string; onType: (text: string) => void };
  onPick: (beast: BestiaryEntrySummary | undefined) => void;
}) {
  const text = typed?.value.trim() ?? "";
  const value = beast
    ? beastOption(beast)
    : text
      ? { id: "typed", title: text, subtitle: "Typed in" }
      : null;
  return (
    <div className="flex flex-col gap-1 text-xs font-bold text-text2">
      {label}
      <SearchSelect
        label={label}
        placeholder="Search creatures"
        emptyText="No creature matches."
        options={bestiary.map(beastOption)}
        value={value}
        clearLabel={`Clear ${label.toLowerCase()}`}
        onChange={(option) => {
          const picked = option ? bestiary.find((entry) => entry.id === option.id) : undefined;
          typed?.onType("");
          onPick(picked);
        }}
        create={
          typed
            ? {
                label: (entry) => `Use “${entry}” as the type`,
                onCreate: (entry) => {
                  onPick(undefined);
                  typed.onType(entry);
                },
              }
            : undefined
        }
      />
    </div>
  );
}
