import { ModalSheet } from "@/components/ui/modal-sheet";

import type { ChartRow } from "../campaign-rule-rows";
import CampaignChartView from "./CampaignChartView";

/** A row's charts in one modal: a lone chart on its own, or an umbrella's charts one after
 * another under the umbrella's name. */
export default function CampaignChartsModal({
  row,
  onClose,
  actions,
}: {
  row: ChartRow | null;
  onClose: () => void;
  actions?: (chartId: number) => React.ReactNode;
}) {
  return (
    <ModalSheet
      open={row !== null}
      onOpenChange={(open) => !open && onClose()}
      kicker="Charts"
      title={row?.name ?? ""}
      className="max-w-[720px]"
      closeButton
    >
      <div className="flex flex-col gap-5">
        {(row?.charts ?? []).map((chart) => (
          <div key={chart.id} className="flex flex-col gap-2">
            <CampaignChartView chart={chart} heading={Boolean(row?.umbrella)} />
            {actions ? <div className="flex flex-wrap gap-2">{actions(chart.id)}</div> : null}
          </div>
        ))}
      </div>
    </ModalSheet>
  );
}
