import { BEAST_KIND_TEXT, BeastKindIcon } from "@/features/bestiary/components/BeastKindIcon";

/** The switched-on mount or pet an entry comes with (step 5). */
export type CompanionEntrySource = { kind: "mount" | "pet"; name: string };

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
