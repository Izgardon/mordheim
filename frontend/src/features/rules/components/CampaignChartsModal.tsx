import { ModalSheet } from "@/components/ui/modal-sheet";
import { cn } from "@/lib/utils";

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
      <div className="flex flex-col">
        {(row?.charts ?? []).map((chart, index) => (
          <div
            key={chart.id}
            // a rule between the charts an umbrella holds, as the rules modal has (William, 20 Nov 2026)
            className={cn("flex flex-col gap-2", index > 0 && "mt-6 border-t border-strong pt-6")}
          >
            <CampaignChartView chart={chart} heading={Boolean(row?.umbrella)} />
            {actions ? <div className="flex flex-wrap gap-2">{actions(chart.id)}</div> : null}
          </div>
        ))}
      </div>
    </ModalSheet>
  );
}
