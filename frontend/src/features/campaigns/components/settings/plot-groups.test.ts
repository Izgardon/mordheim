/**
 * Settings → Plots by setting (William, 28 Nov 2026: "plots within settings can we order them by
 * setting please"): the settings list's order, the campaign's own last, by name within each.
 */
import { describe, expect, it } from "vitest";

import type { PlotRow } from "@/features/plots/types/plot-types";

import type { Setting } from "../../types/campaign-types";
import { settingsById } from "../../api/settings-queries";
import { plotGroups } from "./plot-groups";

const setting = (id: number, name: string, sort_order: number): Setting => ({
  id,
  slug: name.toLowerCase().replace(/ /g, "-"),
  name,
  grade: "2b",
  grade_label: "Supplemental",
  sort_order,
  always_on: false,
  warband_types: 0,
});

// the server's order (sort_order, name): the map keeps it
const SETTINGS = settingsById([
  setting(10, "Border Town Burning", 10),
  setting(12, "Mutiny in Marienburg", 12),
  setting(18, "The Sealed City", 18),
]);

const plot = (id: number, name: string, setting_id: number | null, campaign_id: number | null) =>
  ({
    id,
    name,
    summary: "",
    who_text: "",
    variant_of: "",
    no_alliance_with: [],
    campaign_id,
    setting_id,
  }) satisfies PlotRow;

describe("plotGroups", () => {
  it("puts the plots under their settings in order, the campaign's own last, by name", () => {
    const groups = plotGroups(
      [
        plot(1, "Our Own Way", null, 3),
        plot(2, "The Watch", 18, null),
        plot(3, "Smugglers", 12, null),
        plot(4, "Cargo Kings", 12, 3),
        plot(5, "Burn It Down", 10, null),
      ],
      SETTINGS
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Border Town Burning",
      "Mutiny in Marienburg",
      "The Sealed City",
      "This campaign's own",
    ]);
    // the campaign's version of a book plot stays under its setting
    expect(groups[1].plots.map((row) => row.name)).toEqual(["Cargo Kings", "Smugglers"]);
  });

  it("follows the settings' order, not their names", () => {
    const reordered = settingsById([
      setting(18, "The Sealed City", 1),
      setting(10, "Border Town Burning", 2),
    ]);
    const groups = plotGroups([plot(1, "A", 10, null), plot(2, "B", 18, null)], reordered);

    expect(groups.map((group) => group.label)).toEqual(["The Sealed City", "Border Town Burning"]);
  });
});
