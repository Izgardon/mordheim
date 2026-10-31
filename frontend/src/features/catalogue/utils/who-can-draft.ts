import type { AccessLine, AccessLineInput } from "@/features/items/types/item-types";

/** One line of a who-can list as a form edits it: a warband type or group, and whether it is out. */
export type AccessDraft = {
  kind: "type" | "group";
  id: number;
  name: string;
  excluded: boolean;
};

/** A who-can list as a form edits it: everyone (minus the excluded lines), or the lines named. */
export type WhoCanDraft = { forEveryone: boolean; lines: AccessDraft[] };

export const everyone = (): WhoCanDraft => ({ forEveryone: true, lines: [] });

/** A payload's lines as the form edits them. */
export function draftOf(list: { for_everyone: boolean; warbands: AccessLine[] }): WhoCanDraft {
  return {
    forEveryone: list.for_everyone,
    lines: list.warbands.map((line) => ({
      kind: line.warband_type_id ? "type" : "group",
      id: (line.warband_type_id ?? line.warband_group_id) as number,
      name: line.name,
      excluded: line.excluded,
    })),
  };
}

/** The draft as a payload reads, for the "For Skaven, Lizardmen" line while editing. */
export const listOf = (draft: WhoCanDraft): { for_everyone: boolean; warbands: AccessLine[] } => ({
  for_everyone: draft.forEveryone,
  warbands: draft.lines.map((line) => ({
    warband_type_id: line.kind === "type" ? line.id : null,
    warband_group_id: line.kind === "group" ? line.id : null,
    name: line.name,
    excluded: line.excluded,
  })),
});

/** The lines as a write sends them. */
export const linesPayload = (draft: WhoCanDraft): AccessLineInput[] =>
  draft.lines.map((line) => ({
    ...(line.kind === "type" ? { warband_type_id: line.id } : { warband_group_id: line.id }),
    excluded: line.excluded,
  }));

/**
 * A line added to the list: once each (adding it again moves it), included unless the list is for
 * everyone (then the only lines that say anything are the excluded ones).
 */
export function addLine(draft: WhoCanDraft, line: Omit<AccessDraft, "excluded">): WhoCanDraft {
  const rest = draft.lines.filter((entry) => !(entry.kind === line.kind && entry.id === line.id));
  return { ...draft, lines: [...rest, { ...line, excluded: draft.forEveryone }] };
}

export const removeLine = (draft: WhoCanDraft, index: number): WhoCanDraft => ({
  ...draft,
  lines: draft.lines.filter((_, at) => at !== index),
});

export const toggleExcluded = (draft: WhoCanDraft, index: number): WhoCanDraft => ({
  ...draft,
  lines: draft.lines.map((line, at) =>
    at === index ? { ...line, excluded: !line.excluded } : line
  ),
});
