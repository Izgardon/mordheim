import type { Setting } from "@/features/campaigns/types/campaign-types";
import {
  ALL_SETTINGS,
  entrySettingKey,
  entrySettingName,
  settingKeyOptions,
} from "@/features/reference/in-play";
import { matchesSearchQuery } from "@/lib/matches-search-query";

import type { TemplateTypeRow } from "./template-view";

/** A row's Setting filter key ("mordheim" for any of Mordheim's grades, "own", or the id). */
export const rowSettingKey = (row: TemplateTypeRow, settings: Map<number, Setting>) =>
  entrySettingKey(row.setting, settings);

/** The Setting column: the setting's own name ("Mordheim 1b"), "Mordheim", or "This campaign". */
export const rowSettingLabel = (row: TemplateTypeRow, settings: Map<number, Setting>) =>
  entrySettingName(row.setting, settings);

/**
 * The Grade column (William, 8 Nov 2026: "on warbands table can we also show grade"): its
 * setting's grade, 1a to 3; "" for a campaign's own or a book type not graded yet.
 */
export const rowGrade = (row: TemplateTypeRow, settings: Map<number, Setting>) =>
  (row.setting.setting_id != null ? settings.get(row.setting.setting_id)?.grade : undefined) ?? "";

/** The Setting filter's options for these rows: All settings, then each once in the book's order. */
export const warbandSettingOptions = (rows: TemplateTypeRow[], settings: Map<number, Setting>) =>
  settingKeyOptions(
    rows.map((row) => rowSettingKey(row, settings)),
    settings
  );

type WarbandFilters = {
  query: string;
  setting: string;
  settings: Map<number, Setting>;
};

/**
 * The rows the Warbands page shows: those the search (type or template name) and the Setting
 * filter keep, by name (William, 26 Nov 2026: "Don't need a setting sort on anything").
 */
export function shownWarbandRows(
  rows: TemplateTypeRow[],
  { query, setting, settings }: WarbandFilters
): TemplateTypeRow[] {
  return rows
    .filter(
      (row) =>
        matchesSearchQuery(query, row.typeName, row.template?.name ?? "") &&
        (setting === ALL_SETTINGS || rowSettingKey(row, settings) === setting)
    )
    .sort((a, b) => a.typeName.localeCompare(b.typeName) || a.id.localeCompare(b.id));
}
