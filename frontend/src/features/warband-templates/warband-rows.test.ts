/**
 * The Warbands page's Setting column (William, 7 Nov 2026: "add Setting column and make it
 * filterable/sortable") and Grade column (William, 8 Nov 2026: "on warbands table can we also
 * show grade"): each row's setting and grade and the Setting filter (Mordheim's grades as one), by
 * name (William, 26 Nov 2026: "Don't need a setting sort on anything").
 */
import { describe, expect, it } from "vitest";

import type { Setting } from "@/features/campaigns/types/campaign-types";
import { ALL_SETTINGS } from "@/features/reference/in-play";

import type { TemplateTypeRow } from "./template-view";
import { rowGrade, rowSettingLabel, shownWarbandRows, warbandSettingOptions } from "./warband-rows";

const setting = (
  id: number,
  slug: string,
  name: string,
  sortOrder: number,
  grade = "1a"
): Setting => ({
  id,
  slug,
  name,
  grade,
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
const shown = (setting: string, query = "") =>
  names(shownWarbandRows(ROWS, { query, setting, settings: SETTINGS }));

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
    expect(shown("6", "lizard")).toEqual(["Lizardmen"]);
  });

  it("shows each row's grade, none for a campaign's own", () => {
    // William, 8 Nov 2026: "on warbands table can we also show grade"
    const graded = new Map(
      [
        setting(1, "mordheim", "Mordheim 1a", 1, "1a"),
        setting(7, "grade-3", "Grade 3", 0, "3"),
        setting(6, "lustria", "Lustria", 6, "1b"),
      ].map((entry) => [entry.id, entry])
    );
    const rows = [
      row("Skaven", 1),
      row("Fimir", 7),
      row("Lizardmen", 6),
      row("House Wolves", null, 7),
      row("Amazons", 6),
    ];
    expect(rows.map((entry) => rowGrade(entry, graded))).toEqual(["1a", "3", "1b", "", "1b"]);
  });
});
