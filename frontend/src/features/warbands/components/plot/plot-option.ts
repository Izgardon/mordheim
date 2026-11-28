import type { SearchOption } from "@/components/ui/search-select";
import { outOfPlay } from "@/features/campaigns/api/settings-queries";
import type { Setting } from "@/features/campaigns/types/campaign-types";
import type { PlotRow } from "@/features/plots/types/plot-types";

/**
 * A plot as every plot picker offers it: its name over its own words on who may follow it
 * (William, 18 Nov 2026: "options should have title of name and subtitles of who can take it"),
 * never matched to warband types. One whose setting isn't ticked is greyed with the warning and
 * still picked (`in_play`, from the campaign's list).
 */
export const plotOption = (plot: PlotRow, settings: Map<number, Setting>): SearchOption => ({
  id: plot.id,
  title: plot.name,
  subtitle: plot.who_text,
  warning: outOfPlay(plot, settings) || undefined,
});
