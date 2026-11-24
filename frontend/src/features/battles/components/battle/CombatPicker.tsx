import { SectionedSelect, type SelectSection } from "@/components/ui/sectioned-select";
import type { UnitStats } from "@/features/battles/components/prebattle/prebattle-types";
import { cn } from "@/lib/utils";

/** A model the helpers can read a profile from, under its picker heading ("Heroes"). */
export type CombatOption = {
  key: string;
  name: string;
  stats: Partial<UnitStats>;
  section?: string;
};

/** The picker's first row, which leaves the numbers to type. */
const TYPED = "typed";

/** The options under their headings, in the order they first come. */
function bySection(options: CombatOption[]): SelectSection[] {
  const sections: SelectSection[] = [];
  for (const option of options) {
    const label = option.section ?? "";
    let section = sections.find((entry) => entry.label === label);
    if (!section) {
      section = { label, options: [] };
      sections.push(section);
    }
    section.options.push({ value: option.key, label: option.name });
  }
  return sections;
}

/** Yours or Theirs: "Type the numbers", then the models under their headings. */
export default function CombatPicker({
  label,
  options,
  value,
  onChange,
  end = false,
}: {
  label: string;
  options: CombatOption[];
  value: string;
  onChange: (key: string) => void;
  /** Theirs: its label on the right, mirroring Yours (William, 24 Nov 2026). */
  end?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 text-xs font-bold text-text2",
        end && "text-right"
      )}
    >
      {label}
      <SectionedSelect
        aria-label={label}
        className="h-11 min-w-0 pl-2 md:h-11"
        value={value || TYPED}
        onValueChange={(next) => onChange(next === TYPED ? "" : next)}
        sections={[
          { label: "", options: [{ value: TYPED, label: "Type the numbers" }] },
          ...bySection(options),
        ]}
      />
    </div>
  );
}
