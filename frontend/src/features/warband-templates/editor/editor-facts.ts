import type { EditorAnswer, EditorSection, EditorWarning } from "../types/editor-types";

export const SECTIONS: { id: EditorSection; label: string }[] = [
  { id: "basics", label: "Basics" },
  { id: "fighters", label: "Fighters" },
  { id: "lists", label: "Lists" },
  { id: "rules", label: "Rules" },
  { id: "upgrades", label: "Upgrades" },
];

const SOURCES = {
  book: "The book's",
  house: "The book's, house version",
  custom: "Custom",
} as const;

const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** The header's line: "Custom · copied from Mercenaries · used by 1 warband". */
export function factsLine({ facts }: Pick<EditorAnswer, "facts">) {
  return [
    SOURCES[facts.source],
    facts.copied_from ? `copied from ${facts.copied_from.name}` : "",
    `used by ${counted(facts.warbands, "warband")}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The change note, said once (a lossy action's note): a book template's first save makes the
 * campaign's own house version, and no save reaches a unit already on a roster.
 */
export const changeNote = ({ facts }: Pick<EditorAnswer, "facts">) =>
  `${facts.source === "book" ? "Saving makes this campaign's house version. " : ""}Changes reach the next recruits and list prices, never units already on a roster.`;

/** The warnings of one section (and of one fighter or list, by key). */
export const warningsFor = (warnings: EditorWarning[], section: EditorSection, key?: string) =>
  warnings.filter(
    (warning) => warning.section === section && (key === undefined || warning.key === key)
  );
