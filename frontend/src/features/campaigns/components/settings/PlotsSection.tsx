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
import { plotGroups } from "./plot-groups";
import SettingsDisclosure from "./SettingsDisclosure";
import { CAPTION, FormError } from "./settings-ui";

function PlotRowView({
  plot,
  picked,
  warning,
  busy,
  canEdit,
  onToggle,
  onEdit,
}: {
  plot: PlotRow;
  picked: boolean;
  warning: string;
  busy: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line py-2 first:border-t-0">
      <label className="flex min-w-[220px] flex-1 cursor-pointer items-center gap-2.5">
        <Checkbox checked={picked} disabled={busy} onChange={onToggle} aria-label={plot.name} />
        <span className={cn("text-sm text-ink", plot.in_play === false && "text-faint")}>
          {plot.name}
        </span>
        {/* the campaign's version of a book plot, under its setting */}
        {plot.campaign_id !== null && plot.setting_id !== null ? (
          <span className="text-xs text-text2">Yours</span>
        ) : null}
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
 * Settings → Rules → Plots, shown while Plots and CP is on: which plots the campaign plays
 * with, from every setting, under each setting's heading in the settings' order (`plotGroups`). A plot whose setting isn't
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

  const summary = offered.isLoading ? "Loading…" : `${picked.size} of ${rows.length} played`;
  const outside = rows.filter((plot) => picked.has(plot.id) && outOfPlay(plot, settings)).length;
  const warnings = outside
    ? [
        `${outside} played ${outside === 1 ? "plot isn't" : "plots aren't"} in this campaign's settings.`,
      ]
    : [];

  return (
    <SettingsDisclosure title="Plots" summary={summary} warnings={warnings}>
      {can.edit_catalogue ? (
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => setEditing({ plotId: null })}
        >
          Add a plot
        </Button>
      ) : null}
      {plotGroups(rows, settings).map((group) => (
        <section key={group.key} aria-label={group.label} className="flex flex-col gap-1">
          <h3 className={cn(CAPTION, "m-0 font-sans")}>{group.label}</h3>
          <div className="flex flex-col">
            {group.plots.map((plot) => (
              <PlotRowView
                key={plot.id}
                plot={plot}
                picked={picked.has(plot.id)}
                warning={outOfPlay(plot, settings)}
                busy={pick.isPending}
                canEdit={can.edit_catalogue}
                onToggle={() => toggle(plot.id)}
                onEdit={() => setEditing({ plotId: plot.id })}
              />
            ))}
          </div>
        </section>
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
    </SettingsDisclosure>
  );
}
