/**
 * The reference scoped to the campaign (William, 1 Nov 2026): only entries in play show, and the
 * Setting filter offers Mordheim's grades as one "Mordheim", only for the settings in play.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { settingsById } from "@/features/campaigns/api/settings-queries";
import type { Setting } from "@/features/campaigns/types/campaign-types";
import { useWargearRows } from "@/features/items/routes/wargear-rows";
import type { Item } from "@/features/items/types/item-types";
import { makeItem } from "@/test/warband-fixtures";

import { ALL_SETTINGS, inPlayOnly, settingFilterKey, settingFilterOptions } from "./in-play";

const setting = (id: number, slug: string, name: string, sort_order: number): Setting => ({
  id,
  slug,
  name,
  grade: "1a",
  grade_label: "Official",
  sort_order,
  always_on: id === 1,
  warband_types: 0,
});

const settings = settingsById([
  setting(1, "mordheim", "Mordheim", 1),
  setting(2, "mordheim-1b", "Mordheim 1b", 2),
  setting(3, "mordheim-1c", "Mordheim 1c", 3),
  setting(4, "mordheim-2a", "Mordheim 2a", 4),
  setting(5, "empire-in-flames", "Empire in Flames", 5),
  setting(7, "khemri", "Khemri", 7),
]);

const item = (id: number, settingId: number | null, inPlay: boolean): Item =>
  makeItem({ id, name: `Item ${id}`, setting_id: settingId, in_play: inPlay });

describe("the reference's scope", () => {
  it("leaves out what isn't in play, and keeps the campaign's own entries", () => {
    const rows = [item(1, 1, true), item(2, 7, false), item(3, null, true), item(4, 2, true)];

    expect(inPlayOnly(rows).map((row) => row.id)).toEqual([1, 3, 4]);
    // the book's own list (no campaign) marks nothing
    expect(inPlayOnly([{ in_play: null }, { in_play: undefined }])).toHaveLength(2);
  });

  it("groups Mordheim's grades as one setting", () => {
    expect([1, 2, 3, 4].map((id) => settingFilterKey(id, settings))).toEqual([
      "mordheim",
      "mordheim",
      "mordheim",
      "mordheim",
    ]);
    expect(settingFilterKey(5, settings)).toBe("5");
    expect(settingFilterKey(null, settings)).toBe("own");
  });

  it("offers Mordheim once, then the other settings in their order, the campaign's own last", () => {
    expect(settingFilterOptions([5, 3, null, 1, 2], settings)).toEqual([
      { id: ALL_SETTINGS, label: "All settings" },
      { id: "mordheim", label: "Mordheim" },
      { id: "5", label: "Empire in Flames" },
      { id: "own", label: "This campaign" },
    ]);
  });
});

describe("Wargear's rows", () => {
  const filters = {
    settings,
    offers: null,
    warbandName: null,
    onlyMine: true,
    query: "",
    category: "all" as const,
    openId: null,
  };
  const items = [
    item(1, 1, true),
    item(2, 3, true),
    item(3, 7, false),
    item(4, 5, true),
    item(5, 2, false),
  ];

  it("list only the items in play, and offer only their settings", () => {
    const { result } = renderHook(() => useWargearRows({ ...filters, items, setting: "all" }));

    expect(result.current.rows.map((row) => row.item.id)).toEqual([1, 2, 4]);
    expect(result.current.settingOptions.map((option) => option.label)).toEqual([
      "All settings",
      "Mordheim",
      "Empire in Flames",
    ]);
  });

  it("filter Mordheim's grades together", () => {
    const { result } = renderHook(() => useWargearRows({ ...filters, items, setting: "mordheim" }));

    expect(result.current.rows.map((row) => row.item.id)).toEqual([1, 2]);
  });
});
