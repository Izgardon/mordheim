import { cn } from "@/lib/utils";

import { BEAST_KINDS, beastKindLabel, type BeastKind } from "../bestiary-kinds";
import { BEAST_KIND_TEXT, BeastKindIcon } from "./BeastKindIcon";

const BUTTON_CLASS =
  "touch-target-y inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:flex-none";

/**
 * The Bestiary's Kind filter: All, or one of Mount, Pet and Creature with its mark. A pressed
 * button is the kind shown (`aria-pressed`).
 */
export default function BestiaryKindFilter({
  value,
  onChange,
}: {
  /** The kind shown, or null for every kind. */
  value: BeastKind | null;
  onChange: (kind: BeastKind | null) => void;
}) {
  const options: { kind: BeastKind | null; label: string }[] = [
    { kind: null, label: "All" },
    ...BEAST_KINDS.map((kind) => ({ kind, label: beastKindLabel(kind) })),
  ];
  return (
    <div
      role="group"
      aria-label="Kind"
      // Nothing clips the buttons' taps above and below them on a phone (`touch-target-y`).
      className="flex w-full rounded-md border border-border/60 sm:w-auto"
    >
      {options.map(({ kind, label }) => {
        const pressed = value === kind;
        return (
          <button
            key={label}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(kind)}
            className={cn(
              BUTTON_CLASS,
              "border-r border-border/60 last:border-r-0",
              pressed
                ? cn("bg-accent/20 font-semibold", kind ? BEAST_KIND_TEXT[kind] : "text-foreground")
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {kind ? <BeastKindIcon kind={kind} /> : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}
