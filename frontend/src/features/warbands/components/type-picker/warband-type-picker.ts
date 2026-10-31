import type { WarbandTypeBrief, WarbandTypeRow } from "../../types/warband-types";

/** "Khemri isn't in this campaign": what a type (or a catalogue row) outside its settings says. */
export const outOfPlayWarning = (settingName: string) => `${settingName} isn't in this campaign`;

/** The line under a type's name: its setting and source ("Mordheim · Town Cryer 10"), or "Custom". */
export function typeMeta(type: WarbandTypeBrief) {
  if (!type.setting) return type.campaign_id ? "Custom · this campaign" : type.source;
  const source = type.source === type.setting.name ? "" : type.source; // "Lustria", not "Lustria · Lustria"
  return [type.setting.name, source].filter(Boolean).join(" · ");
}

/** The warning a type outside the campaign's settings carries ("" when it is in play). */
export function typeWarning(type: WarbandTypeRow) {
  return type.in_play === false && type.setting ? outOfPlayWarning(type.setting.name) : "";
}

const fold = (text: string) => text.trim().toLowerCase();

function matches(type: WarbandTypeRow, query: string) {
  if (!query) return true;
  return [type.name, type.race, type.setting?.name ?? "", type.source_code].some((text) =>
    fold(text).includes(query)
  );
}

export type PickerRows = {
  /** In the campaign's settings, or its own. */
  inPlay: WarbandTypeRow[];
  /** Outside them: listed greyed out with a warning, still pickable. */
  outside: WarbandTypeRow[];
  /** What "Add as a custom warband type" would create, or "" when a type already has the name. */
  custom: string;
};

/**
 * The picker's rows for what was typed: name, race, setting or source code contain it; in-play
 * types first, each part by name. A name no type has can be added as the campaign's own.
 */
export function pickerRows(
  types: WarbandTypeRow[],
  typed: string,
  hidden: number[] = []
): PickerRows {
  const query = fold(typed);
  const shown = types.filter((type) => !hidden.includes(type.id) && matches(type, query));
  const byName = (a: WarbandTypeRow, b: WarbandTypeRow) =>
    a.name.localeCompare(b.name) || a.source_code.localeCompare(b.source_code);
  const taken = types.some((type) => fold(type.name) === query);
  return {
    inPlay: shown.filter((type) => type.in_play !== false).sort(byName),
    outside: shown.filter((type) => type.in_play === false).sort(byName),
    custom: query && !taken ? typed.trim() : "",
  };
}

/**
 * The warband link once a new type is picked: the type's link when the field is empty or still
 * holds the old type's link, else the player's own link stays.
 */
export function linkAfterPick(
  current: string,
  previous: WarbandTypeBrief | null,
  picked: WarbandTypeBrief
) {
  const link = current.trim();
  return !link || link === (previous?.link_url ?? "") ? picked.link_url : current;
}
