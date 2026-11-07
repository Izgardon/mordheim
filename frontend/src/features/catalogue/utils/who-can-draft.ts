import type { AccessLine, AccessLineInput } from "@/features/items/types/item-types";

/** One line of a who-can list as a form edits it: a warband type or group, and whether it is out. */
export type AccessDraft = {
  kind: "type" | "group";
  id: number;
  name: string;
  /** A type's source code, which tells two types of one name apart. */
  sourceCode?: string;
  excluded: boolean;
};

/**
 * A who-can list as a form edits it: everyone (minus the excluded lines), or the lines named
 * (Exclude and Include, `WhoCanMode`).
 */
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
      sourceCode: line.source_code ?? "",
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
    source_code: line.sourceCode ?? "",
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
 * Exclude (William, 7 Nov 2026: "Exclude (default on) and Include"): everyone but the lines
 * added, everyone with none; Include: only the lines added, no one with none. It is the list's
 * `for_everyone`, and each line it adds is excluded or included to match.
 */
export type WhoCanMode = "exclude" | "include";

export const modeOf = (draft: WhoCanDraft): WhoCanMode =>
  draft.forEveryone ? "exclude" : "include";

/** The list in `mode`, every line saying what the mode says (a mixed list's lines too). */
export const withMode = (draft: WhoCanDraft, mode: WhoCanMode): WhoCanDraft => ({
  forEveryone: mode === "exclude",
  lines: draft.lines.map((line) => ({ ...line, excluded: mode === "exclude" })),
});

/**
 * Lines that say the opposite of the mode, kept from before the toggle (an include and an
 * exclude together): they load, show and save as they are until the mode is switched.
 */
export const isMixed = (draft: WhoCanDraft) =>
  draft.lines.some((line) => line.excluded !== draft.forEveryone);

/** Who the list lets in, under the toggle: "Everyone except these", "Only these", "No one". */
export function whoCanMeaning(draft: WhoCanDraft) {
  if (draft.forEveryone) {
    return draft.lines.some((line) => line.excluded) ? "Everyone except these" : "Everyone";
  }
  return draft.lines.some((line) => !line.excluded) ? "Only these" : "No one";
}

/** A line added to the list: once each (adding it again moves it), as the mode says. */
export function addLine(draft: WhoCanDraft, line: Omit<AccessDraft, "excluded">): WhoCanDraft {
  const rest = draft.lines.filter((entry) => !(entry.kind === line.kind && entry.id === line.id));
  return { ...draft, lines: [...rest, { ...line, excluded: draft.forEveryone }] };
}

export const removeLine = (draft: WhoCanDraft, index: number): WhoCanDraft => ({
  ...draft,
  lines: draft.lines.filter((_, at) => at !== index),
});
