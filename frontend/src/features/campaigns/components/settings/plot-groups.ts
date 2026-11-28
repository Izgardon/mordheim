import type { PlotRow } from "@/features/plots/types/plot-types";
import { CAMPAIGN_WORDS } from "@/features/reference/own-words";

import type { Setting } from "../../types/campaign-types";

export type PlotGroup = { key: string; label: string; plots: PlotRow[] };

const OWN = "own";
const UNGRADED = "mordheim";

/** A plot's group: its setting (a campaign's version keeps its book plot's), else the campaign's own. */
const groupKey = (plot: PlotRow) =>
  plot.setting_id !== null ? String(plot.setting_id) : plot.campaign_id !== null ? OWN : UNGRADED;

/**
 * Settings → Plots by setting (William, 28 Nov 2026: "plots within settings can we order them by
 * setting please"): the settings in the settings list's order (the server's, as Content in play
 * shows them), a book plot not graded yet first as Mordheim's, the campaign's own last; by name
 * within each.
 */
export function plotGroups(plots: PlotRow[], settings: Map<number, Setting>): PlotGroup[] {
  const order = new Map([...settings.keys()].map((id, index) => [String(id), index]));
  const rank = (key: string) =>
    key === UNGRADED ? -1 : key === OWN ? Infinity : (order.get(key) ?? settings.size);
  const label = (key: string) =>
    key === UNGRADED
      ? "Mordheim"
      : key === OWN
        ? CAMPAIGN_WORDS.own
        : (settings.get(Number(key))?.name ?? "Its setting");
  const groups = new Map<string, PlotRow[]>();
  for (const plot of plots) {
    const key = groupKey(plot);
    groups.set(key, [...(groups.get(key) ?? []), plot]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || label(a).localeCompare(label(b)))
    .map(([key, rows]) => ({
      key,
      label: label(key),
      plots: [...rows].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}
