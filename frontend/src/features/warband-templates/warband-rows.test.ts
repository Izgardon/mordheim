/**
 * The Warbands page's Setting column (William, 7 Nov 2026: "add Setting column and make it
 * filterable/sortable"): each row's setting, the Setting filter (Mordheim's grades as one) and the
 * sort by name or by setting, either way.
 */
import { describe, expect, it } from "vitest";

import type { Setting } from "@/features/campaigns/types/campaign-types";
import { ALL_SETTINGS } from "@/features/reference/in-play";

import type { TemplateTypeRow } from "./template-view";
import {
  DEFAULT_SORT,
  nextSort,
  parseSort,
  rowSettingLabel,
  shownWarbandRows,
  sortParam,
  warbandSettingOptions,
} from "./warband-rows";

const setting = (id: number, slug: string, name: string, sortOrder: number): Setting => ({
  id,
  slug,
  name,
  grade: "1a",
  grade_label: "Official",
  sort_order: sortOrder,
  always_on: false,
  warband_types: 0,
});
const SETTINGS = new Map(
  [
    setting(1, "mordheim", "Mordheim 1a", 1),
    setting(2, "mordheim-1b", "Mordheim 1b", 2),
    setting(6, "lustria", "Lustria", 6),
  ].map((entry) => [entry.id, entry])
);

const row = (
  typeName: string,
  settingId: number | null,
  campaignId: number | null = null
): TemplateTypeRow => ({
  id: typeName,
  typeName,
  template: null,
  variant: "",
  typeId: 1,
  setting: { setting_id: settingId, campaign_id: campaignId },
});

const ROWS = [
  row("Skaven", 1),
  row("Lizardmen", 6),
  row("Ostlanders", 2),
  row("House Wolves", null, 7),
  row("Amazons", 6),
];
const names = (rows: TemplateTypeRow[]) => rows.map((entry) => entry.typeName);
const shown = (setting: string, sort = DEFAULT_SORT, query = "") =>
  names(shownWarbandRows(ROWS, { query, setting, sort, settings: SETTINGS }));

describe("the Setting column", () => {
  it("names each row's setting as it is, a campaign's own as this campaign's", () => {
    expect(ROWS.map((entry) => rowSettingLabel(entry, SETTINGS))).toEqual([
      "Mordheim 1a",
      "Lustria",
      "Mordheim 1b",
      "This campaign",
      "Lustria",
    ]);
    expect(rowSettingLabel(row("Ungraded", null), SETTINGS)).toBe("Mordheim");
  });

  it("filters by setting, Mordheim's grades as one", () => {
    expect(warbandSettingOptions(ROWS, SETTINGS).map((option) => option.label)).toEqual([
      "All settings",
      "Mordheim",
      "Lustria",
      "This campaign",
    ]);
    expect(shown(ALL_SETTINGS)).toEqual([
      "Amazons",
      "House Wolves",
      "Lizardmen",
      "Ostlanders",
      "Skaven",
    ]);
    expect(shown("mordheim")).toEqual(["Ostlanders", "Skaven"]);
    expect(shown("6")).toEqual(["Amazons", "Lizardmen"]);
    expect(shown("own")).toEqual(["House Wolves"]);
    expect(shown("6", DEFAULT_SORT, "lizard")).toEqual(["Lizardmen"]);
  });

  it("sorts by setting in the book's order, then name, and either way", () => {
    const bySetting = { key: "setting", descending: false } as const;
    expect(shown(ALL_SETTINGS, bySetting)).toEqual([
      "Skaven",
      "Ostlanders",
      "Amazons",
      "Lizardmen",
      "House Wolves",
    ]);
    expect(shown(ALL_SETTINGS, { ...bySetting, descending: true })).toEqual([
      "House Wolves",
      "Lizardmen",
      "Amazons",
      "Ostlanders",
      "Skaven",
    ]);
    expect(shown("mordheim", { key: "name", descending: true })).toEqual(["Skaven", "Ostlanders"]);
  });

  it("keeps the sort in ?sort=, a heading's click turning it round", () => {
    expect(parseSort("")).toEqual(DEFAULT_SORT);
    expect(parseSort("-setting")).toEqual({ key: "setting", descending: true });
    expect(parseSort("rubbish")).toEqual(DEFAULT_SORT);
    expect(sortParam(DEFAULT_SORT)).toBeNull();
    expect(sortParam({ key: "setting", descending: true })).toBe("-setting");
    expect(nextSort(DEFAULT_SORT, "setting")).toEqual({ key: "setting", descending: false });
    expect(nextSort({ key: "setting", descending: false }, "setting")).toEqual({
      key: "setting",
      descending: true,
    });
    expect(nextSort(DEFAULT_SORT, "name")).toEqual({ key: "name", descending: true });
  });
});
