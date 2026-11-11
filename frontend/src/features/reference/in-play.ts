import type { Setting } from "@/features/campaigns/types/campaign-types";

/**
 * The reference pages and Search everything list only what is in play in the campaign (William,
 * 1 Nov 2026): entries of its ticked and always-on settings, and its own. The server marks the
 * rest `in_play: false`; they don't show at all.
 */
export function inPlayOnly<T extends { in_play?: boolean | null }>(rows: T[]): T[] {
  return rows.filter((row) => row.in_play !== false);
}

export const ALL_SETTINGS = "all";
const MORDHEIM = "mordheim";
/** An entry with no setting: the campaign's own. */
const OWN = "own";

/** The grade a part of a split setting carries at the end of its slug and of its name ("khemri-3"). */
const GRADE_SUFFIX = /[ -](?:1a|1b|1c|2a|2b|3)$/;

/**
 * A setting family: one book split by grade, shown as one setting (Mordheim 1a to 2a as "Mordheim",
 * Khemri 1b and Khemri 3 as "Khemri"). It is read from the settings themselves, so the next split
 * needs no code here: a part carries its grade at the end of its slug, and the base part keeps the
 * family's bare slug ("khemri-3" beside "khemri"). "Grade 3" stands alone — nothing is named "grade".
 */
export type SettingFamily = { key: string; label: string; order: number };

const FAMILIES = new WeakMap<Map<number, Setting>, Map<number, SettingFamily>>();

function readFamilies(settings: Map<number, Setting>): Map<number, SettingFamily> {
  const bySlug = new Map([...settings.values()].map((row) => [row.slug, row]));
  const parts = new Map<string, Setting[]>();
  for (const row of settings.values()) {
    const base = row.slug.replace(GRADE_SUFFIX, "");
    if (base !== row.slug && bySlug.has(base)) parts.set(base, [...(parts.get(base) ?? []), row]);
  }
  const found = new Map<number, SettingFamily>();
  for (const [base, members] of parts) {
    const head = bySlug.get(base) as Setting;
    const family = {
      key: base,
      label: head.name.replace(GRADE_SUFFIX, ""),
      order: head.sort_order,
    };
    for (const member of [head, ...members]) found.set(member.id, family);
  }
  return found;
}

/** Each setting's family, by setting id; settings outside one are missing. Read once per settings map. */
export function settingFamilies(settings: Map<number, Setting>): Map<number, SettingFamily> {
  const held = FAMILIES.get(settings);
  if (held) return held;
  const found = readFamilies(settings);
  FAMILIES.set(settings, found);
  return found;
}

/** A row's Setting filter key: its family's slug ("mordheim", "khemri"), "own", or the setting's id. */
export function settingFilterKey(
  settingId: number | null | undefined,
  settings: Map<number, Setting>
): string {
  if (settingId == null) return OWN;
  return settingFamilies(settings).get(settingId)?.key ?? String(settingId);
}

/**
 * A row's setting as the Wargear column and card name it: the family's name for a part of a split
 * setting ("Mordheim", "Khemri"), else the setting's own name ("Sartosa"), and nothing for an entry
 * with no setting (the campaign's own).
 */
export function settingShortName(
  settingId: number | null | undefined,
  settings: Map<number, Setting>
) {
  if (settingId == null || !settings.has(settingId)) return "";
  return settingKeyLabel(settingFilterKey(settingId, settings), settings);
}

type SettingRow = {
  setting_id?: number | null;
  campaign_id?: number | null;
  replaces?: number | null;
};

/**
 * The Setting filter key of a row whose book entries may have no setting yet (skills, specials): a
 * book entry with none, and a campaign's version of one, is Mordheim's; a custom entry the
 * campaign's own.
 */
export function entrySettingKey(row: SettingRow, settings: Map<number, Setting>): string {
  if (row.setting_id != null) return settingFilterKey(row.setting_id, settings);
  return row.campaign_id != null && row.replaces == null ? OWN : MORDHEIM;
}

/** A Setting filter key's name: "Mordheim", "Khemri", "This campaign". */
function settingKeyOption(key: string, settings: Map<number, Setting>) {
  if (key === OWN) return { id: key, label: "This campaign", order: Infinity };
  const family = [...settingFamilies(settings).values()].find((row) => row.key === key);
  if (family) return { id: key, ...family };
  // a book entry not graded yet counts as Mordheim's, whether or not Mordheim is split here
  if (key === MORDHEIM) return { id: key, label: "Mordheim", order: -Infinity };
  const setting = settings.get(Number(key));
  return { id: key, label: setting?.name ?? "Unknown", order: setting?.sort_order ?? 998 };
}

export const settingKeyLabel = (key: string, settings: Map<number, Setting>) =>
  settingKeyOption(key, settings).label;

/**
 * A row's setting as an open row or the Warbands page's column names it: the setting's own name
 * ("Mordheim 1b", "Lustria"), else "Mordheim" (a book entry not graded yet) or "This campaign".
 */
export function entrySettingName(row: SettingRow, settings: Map<number, Setting>) {
  const setting = row.setting_id != null ? settings.get(row.setting_id) : undefined;
  return setting?.name ?? settingKeyLabel(entrySettingKey(row, settings), settings);
}

/**
 * The Setting filter's options for these Setting filter keys: All settings, then each one once in
 * the book's order (Mordheim first, a split setting's grades as one), the campaign's own last.
 */
export function settingKeyOptions(keys: string[], settings: Map<number, Setting>) {
  const options = [...new Set(keys)].map((key) => settingKeyOption(key, settings));
  return [
    { id: ALL_SETTINGS, label: "All settings" },
    ...options.sort((a, b) => a.order - b.order).map(({ id, label }) => ({ id, label })),
  ];
}

/** The Setting filter's options for these rows' settings (`settingKeyOptions`). */
export function settingFilterOptions(
  settingIds: (number | null | undefined)[],
  settings: Map<number, Setting>
) {
  return settingKeyOptions(
    settingIds.map((id) => settingFilterKey(id, settings)),
    settings
  );
}
