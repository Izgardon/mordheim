import { useState } from "react";
import { toast } from "sonner";

import { ModalSheet } from "@/components/ui/modal-sheet";
import { SearchCombobox } from "@/components/ui/search-select";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { useCampaignPlots } from "@/features/plots/api/plots-queries";
import { getErrorMessage } from "@/lib/get-error-message";

import { useWarbandPlot } from "../../api/plot-queries";
import { plotOption } from "./plot-option";

/**
 * Choose a plot, on the warband page's campaign points row while the warband follows none
 * (William, 28 Nov 2026: "If not plot selected then we need a way to choose plot from here,
 * otherwise we dont"): the campaign's plots in a modal on the web and a bottom sheet on a phone,
 * saved through the warband PATCH as Settings saves one. Changing a plot stays in Settings.
 */
export default function PlotChooser({
  campaignId,
  warbandId,
}: {
  campaignId: number;
  warbandId: number;
}) {
  const [open, setOpen] = useState(false);
  const plots = useCampaignPlots(campaignId, open);
  const settings = useSettingsById();
  const save = useWarbandPlot(campaignId, warbandId);
  const rows = plots.data ?? [];
  const options = rows.map((row) => plotOption(row, settings));

  const pick = (plotId: number, warning?: string) => {
    if (save.isPending) return;
    save.mutate(
      { plot_id: plotId },
      {
        onSuccess: () => {
          setOpen(false);
          if (warning) toast.warning(warning);
        },
      }
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          save.reset();
          setOpen(true);
        }}
        className="min-h-8 min-w-0 truncate border border-strong px-3 text-[13px] font-bold text-accent-text hover:bg-raised"
      >
        Choose a plot
      </button>
      <ModalSheet
        open={open}
        onOpenChange={setOpen}
        kicker="Campaign points"
        title="Choose a plot"
        description="The plots this campaign plays with."
        closeButton
      >
        <div className="flex flex-col gap-2">
          <SearchCombobox
            inline
            autoFocus
            label="Choose a plot"
            placeholder="Search plots"
            emptyText={rows.length ? "No plot matches." : "This campaign has no plots."}
            loading={plots.isLoading}
            options={options}
            onPick={(option) => pick(Number(option.id), option.warning)}
          />
          {save.error ? (
            <p role="alert" className="m-0 text-sm text-danger">
              {getErrorMessage(save.error, "Couldn't save that.")}
            </p>
          ) : null}
        </div>
      </ModalSheet>
    </>
  );
}
