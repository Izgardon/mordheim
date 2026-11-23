import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { queryKeys } from "@/lib/query-keys";

import { useCampaignPreset, useCampaignPresets } from "../../api/preset-queries";
import type { CampaignPreset, CampaignSummary } from "../../types/campaign-types";
import { useCampaignSave } from "./CampaignSection";
import { setsLine } from "./campaign-preset";
import { SettingRow, SettingsCard } from "./settings-ui";

/** "55 rules and 14 tables", leaving out whichever the preset has none of. */
function countWords(rules: number, charts: number) {
  const parts = [
    rules ? `${rules} ${rules === 1 ? "rule" : "rules"}` : "",
    charts ? `${charts} ${charts === 1 ? "table" : "tables"}` : "",
  ].filter(Boolean);
  return parts.join(" and ");
}

/** What changing to this preset would set, and what it would swap, for the confirm dialog. */
function ChangeSummary({ preset }: { preset: CampaignPreset }) {
  const line = setsLine(preset.sets);
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-ink">{`Play ${preset.name}?`}</p>
      <p className="m-0 text-sm text-text2">
        {line ? `It sets ${line}.` : "It sets nothing: the settings stay as they are."}
      </p>
      {preset.setting_names.length ? (
        <p className="m-0 text-sm text-text2">
          {`It ticks ${preset.setting_names.join(", ")} in the content in play; nothing is unticked.`}
        </p>
      ) : null}
      {preset.rule_count || preset.chart_count ? (
        <p className="m-0 text-sm text-text2">
          {`Its ${countWords(preset.rule_count, preset.chart_count)} are copied in, and the ones the campaign still holds unchanged from another published campaign are taken out. Anything you wrote or edited stays.`}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Settings → Campaign → Campaign (the owner): which published campaign this one plays. Changing
 * it re-applies what that campaign dictates, ticks the settings it guides towards, and swaps its
 * rules and charts in there and then (William, 20 Nov 2026): the dialog says so before it happens,
 * because taking rules out is lossy. Every control it sets stays operable, greyed, and warns when
 * the owner departs from it (`PresetNote`).
 */
export default function CampaignPresetCard({ campaign }: { campaign: CampaignSummary }) {
  const presets = useCampaignPresets();
  const state = useCampaignPreset(campaign.id);
  const queryClient = useQueryClient();
  const { saving, error, save } = useCampaignSave(campaign.id, "Couldn't save that.");
  const [changing, setChanging] = useState<CampaignPreset | null>(null);
  const rows = presets.data ?? [];
  const current = campaign.preset_id ?? null;

  const pick = (value: string) => {
    const preset = rows.find((row) => row.id === Number(value));
    if (!preset || preset.id === current) return;
    setChanging(preset);
  };

  const change = async () => {
    if (!changing) return;
    if (await save({ preset_id: changing.id })) {
      setChanging(null);
      // what it dictates moved: this card, the chart the post-game explores by and its plots
      for (const key of [
        queryKeys.campaign.preset(campaign.id),
        queryKeys.campaign.explorationChart(campaign.id),
        queryKeys.campaign.plots(campaign.id),
      ]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    }
  };

  return (
    <SettingsCard
      title="Campaign preset"
      description="Which published campaign this one plays. It sets the rules; the content in play is yours to change."
    >
      <SettingRow label="Playing" error={error}>
        <select
          aria-label="Published campaign"
          value={current ?? ""}
          disabled={saving || presets.isLoading}
          onChange={(event) => pick(event.target.value)}
          className="min-h-10 border border-strong bg-page px-2.5 text-sm text-ink"
        >
          <option value="">None</option>
          {rows.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </SettingRow>
      {state.data?.preset_id ? (
        <SettingRow
          label="It sets"
          hint={setsLine(state.data.sets) || "Nothing: every setting below is yours."}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(changing)}
        onOpenChange={(open) => (open ? null : setChanging(null))}
        title="Change the campaign"
        description={changing ? <ChangeSummary preset={changing} /> : null}
        confirmText={saving ? "Saving…" : "Change the campaign"}
        confirmVariant="primary"
        isConfirming={saving}
        error={error}
        onConfirm={() => void change()}
      />
    </SettingsCard>
  );
}
