import { useQueryClient } from "@tanstack/react-query";

import {
  useCampaignExplorationChart,
  useExplorationCharts,
} from "@/features/exploration/api/exploration-queries";
import type { ExplorationChartRow } from "@/features/exploration/types/exploration-types";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

import { usePresetLocks } from "../../api/preset-queries";
import { settingShortName } from "@/features/reference/in-play";

import { outOfPlay, useSettingsById } from "../../api/settings-queries";
import type { CampaignSummary, Setting } from "../../types/campaign-types";
import { useCampaignSave } from "../../hooks/settings/useCampaignSave";
import PresetNote, { presetDim } from "./PresetNote";
import { SettingRow } from "./settings-ui";

/** A campaign's own chart says so; a book chart is named for its setting already (William, 18 Nov 2026). */
const source = (chart: ExplorationChartRow) => (chart.campaign_id === null ? "" : " (Yours)");

/**
 * What the dropdown calls a chart: its **setting**, with no "Exploration" and not the chart's own
 * written name (William, 20 Nov 2026: "just Mutiny in Marienburg for example"), so "Wasteland
 * Exploration" reads as Mutiny in Marienburg and "Exploration" as Mordheim. A split setting shows
 * its family's name, as the reference pages do ("Khemri 1b" is Khemri). A campaign's own chart has
 * no setting, so it keeps the name its author gave it.
 */
const chartLabel = (chart: ExplorationChartRow, settings: Map<number, Setting>) =>
  settingShortName(chart.campaign_type_id, settings) || chart.name;

/**
 * Settings → Rules → Exploration chart (`edit_settings`, the owner): which chart the post-game
 * explores by, a dropdown in the open rather than folded away. The
 * book's Mordheim chart until another is picked. A chart whose setting isn't ticked is greyed and
 * still pickable, with the warning under it once picked (restrictions warn, they never block), and
 * the chart the campaign's preset sets is greyed the same way, warning once another is picked.
 */
export default function ExplorationSection({ campaign }: { campaign: CampaignSummary }) {
  const charts = useExplorationCharts(campaign.id);
  const inUse = useCampaignExplorationChart(campaign.id);
  const settings = useSettingsById();
  const locks = usePresetLocks(campaign.id);
  const queryClient = useQueryClient();
  const { saving, error, save } = useCampaignSave(campaign.id, "Couldn't save that.");
  const rows = charts.data ?? [];
  // what it explores by now: the chart it picked, else the one the server hands the post-game
  const current = campaign.exploration_chart_id ?? inUse.data?.id ?? null;
  const picked = rows.find((chart) => chart.id === current);
  const warning = picked ? outOfPlay(picked, settings) : "";

  const pick = (value: string) => {
    const chartId = Number(value);
    if (!chartId || chartId === current) return;
    void save({ exploration_chart_id: chartId }).then((saved) => {
      if (saved) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.campaign.explorationChart(campaign.id),
        });
      }
    });
  };

  return (
    <SettingRow
      label="Exploration chart"
      hint={
        locks.sets.has("exploration_chart_id") ? (
          <PresetNote locks={locks} field="exploration_chart_id" />
        ) : (
          inUse.data?.summary || undefined
        )
      }
      error={error}
      below={warning ? <p className="m-0 text-sm text-accent-text">{warning}.</p> : undefined}
    >
      <select
        aria-label="Exploration chart"
        value={current ?? ""}
        disabled={saving || charts.isLoading || rows.length === 0}
        onChange={(event) => pick(event.target.value)}
        className={cn(
          // w-full and min-w-0: a select is as wide as its widest option, which ran off a phone
          "min-h-10 w-full min-w-0 max-w-full border border-strong bg-page px-2.5 text-sm text-ink",
          presetDim(locks, "exploration_chart_id")
        )}
      >
        {current === null ? <option value="">Loading…</option> : null}
        {rows.map((chart) => (
          <option
            key={chart.id}
            value={chart.id}
            className={cn(chart.in_play === false && "text-faint")}
          >
            {chartLabel(chart, settings)}
            {source(chart)}
            {chart.in_play === false ? " — not in this campaign" : ""}
          </option>
        ))}
      </select>
    </SettingRow>
  );
}
