import { useQueryClient } from "@tanstack/react-query";

import {
  useCampaignExplorationChart,
  useExplorationCharts,
} from "@/features/exploration/api/exploration-queries";
import type { ExplorationChartRow } from "@/features/exploration/types/exploration-types";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

import { usePresetLocks } from "../../api/preset-queries";
import { outOfPlay, useSettingsById } from "../../api/settings-queries";
import type { CampaignSummary } from "../../types/campaign-types";
import { useCampaignSave } from "./CampaignSection";
import PresetNote, { presetDim } from "./PresetNote";
import { SettingRow, SettingsCard } from "./settings-ui";

const source = (chart: ExplorationChartRow) =>
  chart.campaign_id === null ? "The book's" : "Yours";

/**
 * Settings → Exploration (`edit_settings`, the owner): which chart the post-game explores by. The
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
    <SettingsCard
      title="Exploration"
      description="The chart the post-game explores by: its income table and the places the multiples find."
    >
      <SettingRow
        label="Chart"
        hint={
          locks.sets.has("exploration_chart_id") ? (
            <PresetNote locks={locks} field="exploration_chart_id" />
          ) : (
            inUse.data?.summary || undefined
          )
        }
        error={error}
      >
        <select
          aria-label="Exploration chart"
          value={current ?? ""}
          disabled={saving || charts.isLoading || rows.length === 0}
          onChange={(event) => pick(event.target.value)}
          className={cn(
            "min-h-10 border border-strong bg-page px-2.5 text-sm text-ink",
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
              {chart.name} ({source(chart)})
              {chart.in_play === false ? " — not in this campaign" : ""}
            </option>
          ))}
        </select>
      </SettingRow>
      {warning ? <p className="m-0 text-sm text-accent-text">{warning}.</p> : null}
    </SettingsCard>
  );
}
