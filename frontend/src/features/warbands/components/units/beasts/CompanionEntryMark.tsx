import { BEAST_KIND_TEXT, BeastKindIcon } from "@/features/bestiary/components/BeastKindIcon";

/** The switched-on mount or pet an entry comes with (step 5). */
export type CompanionEntrySource = { kind: "mount" | "pet"; name: string };

/**
 * How an entry row and its name button flex: a row with a beast's extras (a companion's mark and
 * DC, an Animal item's switch and menu) wraps them under the name when the column is narrow (the
 * name's basis is its own width), so the name keeps its words instead of breaking a letter per
 * line; any other row keeps its one line.
 */
export const entryFlex = (companion: unknown) =>
  companion ? { row: "flex-wrap", button: "flex-auto" } : { row: "", button: "flex-1" };

/** After a companion's entry: the mount's or pet's mark and the beast's name. */
export function CompanionEntryMark({ kind, name }: CompanionEntrySource) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[0.6rem] ${BEAST_KIND_TEXT[kind]}`}
    >
      <BeastKindIcon kind={kind} className="h-3 w-3" />
      {name}
    </span>
  );
}

/** Inside a companion's entry button, for screen readers: " (from Warhorse, mount)". */
export function CompanionEntryFrom({ kind, name }: CompanionEntrySource) {
  return (
    <span className="sr-only">
      {" "}
      (from {name}, {kind})
    </span>
  );
}
