import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import {
  useCampaignPlots,
  usePlotCatalogue,
  useSetCampaignPlots,
} from "@/features/plots/api/plots-queries";
import PlotEditor from "@/features/plots/editor/PlotEditor";
import type { PlotRow } from "@/features/plots/types/plot-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { outOfPlay, useSettingsById } from "../../api/settings-queries";
import type { CampaignSummary } from "../../types/campaign-types";
import { FormError, SettingsCard } from "./settings-ui";

type Setting = { name: string };

/** Where the plot comes from: its setting, or the campaign itself. */
const source = (plot: PlotRow, settings: Map<number, Setting>) =>
  plot.campaign_id !== null
    ? "Yours"
    : ((plot.setting_id !== null ? settings.get(plot.setting_id)?.name : undefined) ?? "Mordheim");

function PlotRowView({
  plot,
  picked,
  warning,
  busy,
  canEdit,
  onToggle,
  onEdit,
  settings,
}: {
  plot: PlotRow;
  picked: boolean;
  warning: string;
  busy: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: () => void;
  settings: Map<number, Setting>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line py-2 first:border-t-0">
      <label className="flex min-w-[220px] flex-1 cursor-pointer items-center gap-2.5">
        <Checkbox checked={picked} disabled={busy} onChange={onToggle} aria-label={plot.name} />
        <span className={cn("text-sm text-ink", plot.in_play === false && "text-faint")}>
          {plot.name}
        </span>
        <span className="text-xs text-text2">{source(plot, settings)}</span>
      </label>
      {picked && warning ? <span className="text-xs text-accent-text">{warning}.</span> : null}
      {canEdit && plot.campaign_id !== null ? (
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Settings → Plots, shown while Plots and CP is on: which plots the campaign plays
 * with, from every setting, each marked with where it comes from. A plot whose setting isn't
 * ticked is greyed and still pickable, with the warning beside it once picked. Switching Plots on
 * gave the campaign its preset's plots; from then on this list is the list.
 */
export default function PlotsSection({ campaign }: { campaign: CampaignSummary }) {
  const offered = usePlotCatalogue(campaign.id);
  const inUse = useCampaignPlots(campaign.id);
  const settings = useSettingsById();
  const pick = useSetCampaignPlots(campaign.id);
  const [editing, setEditing] = useState<{ plotId: number | null } | null>(null);
  const can = campaignCapabilities(campaign);
  const rows = offered.data ?? [];
  const picked = new Set((inUse.data ?? []).map((plot) => plot.id));

  const toggle = (plotId: number) => {
    const next = new Set(picked);
    if (next.has(plotId)) next.delete(plotId);
    else next.add(plotId);
    pick.mutate([...next]);
  };

  return (
    <SettingsCard
      title="Plots"
      description="The plots this campaign plays with."
      action={
        can.edit_catalogue ? (
          <Button variant="secondary" onClick={() => setEditing({ plotId: null })}>
            Add a plot
          </Button>
        ) : null
      }
    >
      {rows.map((plot) => (
        <PlotRowView
          key={plot.id}
          plot={plot}
          picked={picked.has(plot.id)}
          warning={outOfPlay(plot, settings)}
          busy={pick.isPending}
          canEdit={can.edit_catalogue}
          settings={settings}
          onToggle={() => toggle(plot.id)}
          onEdit={() => setEditing({ plotId: plot.id })}
        />
      ))}
      {!offered.isLoading && rows.length === 0 ? (
        <p className="m-0 text-sm text-text2">No plots yet.</p>
      ) : null}
      <FormError message={pick.error ? getErrorMessage(pick.error, "Couldn't save that.") : ""} />
      {editing ? (
        <PlotEditor
          campaignId={campaign.id}
          plotId={editing.plotId}
          canDelete={can.delete_catalogue}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </SettingsCard>
  );
}
