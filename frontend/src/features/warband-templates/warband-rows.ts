import type { Setting } from "@/features/campaigns/types/campaign-types";
import {
  ALL_SETTINGS,
  entrySettingKey,
  entrySettingName,
  settingKeyOptions,
} from "@/features/reference/in-play";
import { matchesSearchQuery } from "@/lib/matches-search-query";

import type { TemplateTypeRow } from "./template-view";

/** What the Warbands page sorts by: the name or the setting, each either way (`?sort=-setting`). */
export type WarbandSortKey = "name" | "setting";
export type WarbandSort = { key: WarbandSortKey; descending: boolean };

export const DEFAULT_SORT: WarbandSort = { key: "name", descending: false };

/** `?sort=`: "setting", "-name"; anything else is by name. */
export function parseSort(param: string): WarbandSort {
  const descending = param.startsWith("-");
  const key = descending ? param.slice(1) : param;
  return key === "setting" ? { key, descending } : { key: "name", descending };
}

export const sortParam = (sort: WarbandSort) =>
  sort.key === DEFAULT_SORT.key && !sort.descending
    ? null
    : `${sort.descending ? "-" : ""}${sort.key}`;

/** A header's click: its key the other way when it already sorts by it, else its key A to Z. */
export const nextSort = (sort: WarbandSort, key: WarbandSortKey): WarbandSort =>
  sort.key === key ? { key, descending: !sort.descending } : { key, descending: false };

/** A row's Setting filter key ("mordheim" for any of Mordheim's grades, "own", or the id). */
export const rowSettingKey = (row: TemplateTypeRow, settings: Map<number, Setting>) =>
  entrySettingKey(row.setting, settings);

/** The Setting column: the setting's own name ("Mordheim 1b"), "Mordheim", or "This campaign". */
export const rowSettingLabel = (row: TemplateTypeRow, settings: Map<number, Setting>) =>
  entrySettingName(row.setting, settings);

/** Where a row's setting sorts: the book's order (Mordheim's grades first), the campaign's own last. */
function settingOrder(row: TemplateTypeRow, settings: Map<number, Setting>) {
  const setting = row.setting.setting_id != null ? settings.get(row.setting.setting_id) : undefined;
  if (setting) return setting.sort_order;
  return rowSettingKey(row, settings) === "mordheim" ? -Infinity : Infinity;
}

/** The Setting filter's options for these rows: All settings, then each once in the book's order. */
export const warbandSettingOptions = (rows: TemplateTypeRow[], settings: Map<number, Setting>) =>
  settingKeyOptions(
    rows.map((row) => rowSettingKey(row, settings)),
    settings
  );

type WarbandFilters = {
  query: string;
  setting: string;
  sort: WarbandSort;
  settings: Map<number, Setting>;
};

/**
 * The rows the Warbands page shows: those the search (type or template name) and the Setting
 * filter keep, by name or by setting (then name), either way.
 */
export function shownWarbandRows(
  rows: TemplateTypeRow[],
  { query, setting, sort, settings }: WarbandFilters
): TemplateTypeRow[] {
  const kept = rows.filter(
    (row) =>
      matchesSearchQuery(query, row.typeName, row.template?.name ?? "") &&
      (setting === ALL_SETTINGS || rowSettingKey(row, settings) === setting)
  );
  const byName = (a: TemplateTypeRow, b: TemplateTypeRow) =>
    a.typeName.localeCompare(b.typeName) || a.id.localeCompare(b.id);
  const compare =
    sort.key === "setting"
      ? (a: TemplateTypeRow, b: TemplateTypeRow) =>
          settingOrder(a, settings) - settingOrder(b, settings) || byName(a, b)
      : byName;
  const sorted = [...kept].sort(compare);
  return sort.descending ? sorted.reverse() : sorted;
}
