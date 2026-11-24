import type { ReactNode } from "react";

import { ModalSheet } from "@/components/ui/modal-sheet";

import type { ChartRow } from "../campaign-rule-rows";
import { ChartRowBody } from "./CampaignRowBodies";

/** A row's charts in one modal: a lone chart on its own, or an umbrella's charts one after
 * another under the umbrella's name. */
export default function CampaignChartsModal({
  row,
  onClose,
  actions,
}: {
  row: ChartRow | null;
  onClose: () => void;
  actions?: (chartId: number) => ReactNode;
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
      {row ? <ChartRowBody row={row} actions={actions} /> : null}
    </ModalSheet>
  );
}
