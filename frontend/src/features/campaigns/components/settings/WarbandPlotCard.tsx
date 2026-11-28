import { toast } from "sonner";

import { useCampaignPlots } from "@/features/plots/api/plots-queries";
import { useWarbandPlot } from "@/features/warbands/api/plot-queries";
import PlotSelect from "@/features/warbands/components/plot/PlotSelect";
import type { Warband } from "@/features/warbands/types/warband-types";
import { getErrorMessage } from "@/lib/get-error-message";

import { SettingsCard } from "./settings-ui";

/**
 * The plot the warband follows (apps/plots), changed here and only here (William, 22 Nov 2026: "It
 * should only be changeable from warband settings page"); the warband page shows its points and
 * track, and chooses one only while it follows none (`PlotChooser`). Changed for nothing, as often
 * as the player likes. Shown while the campaign has Plots on.
 */
export default function WarbandPlotCard({
  warband,
  canEdit,
  onSaved,
}: {
  warband: Warband;
  canEdit: boolean;
  onSaved: (patch: Partial<Warband>) => void;
}) {
  const save = useWarbandPlot(warband.campaign_id, warband.id);
  const plots = useCampaignPlots(warband.campaign_id);
  const current = warband.plot_id ?? null;
  const name = plots.data?.find((row) => row.id === current)?.name ?? "No plot";
  const pick = (plotId: number | null) =>
    save.mutate(
      { plot_id: plotId },
      {
        onSuccess: () => onSaved({ plot_id: plotId }),
        onError: (error) => toast.error(getErrorMessage(error, "Couldn't save that.")),
      }
    );

  return (
    <SettingsCard title="Plot">
      {canEdit ? (
        <PlotSelect campaignId={warband.campaign_id} value={current} onChange={pick} />
      ) : (
        <p className="m-0 text-sm text-ink">{name}</p>
      )}
    </SettingsCard>
  );
}
