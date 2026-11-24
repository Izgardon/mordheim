import type { ReactNode } from "react";

import { ModalSheet } from "@/components/ui/modal-sheet";

import type { RuleRow } from "../campaign-rule-rows";
import { RuleRowBody } from "./CampaignRowBodies";

/**
 * A row's rules in one modal (William, 19 Nov 2026: "they should each get their own modal appear",
 * "Umbrellas one modal for all shared rules"): a lone rule shows its body under its title, and an
 * umbrella's rules show one after another under the umbrella's name.
 */
export default function CampaignRulesModal({
  row,
  kicker,
  onClose,
  actions,
}: {
  row: RuleRow | null;
  /** The line above the title: which list the row came from ("Battle rules"). */
  kicker: string;
  onClose: () => void;
  /** The owner's and admins' buttons for one rule: edit, and moving the row. */
  actions?: (ruleId: number) => ReactNode;
}) {
  return (
    <ModalSheet
      open={row !== null}
      onOpenChange={(open) => !open && onClose()}
      kicker={kicker}
      title={row?.name ?? ""}
      className="max-w-[720px]"
      closeButton
    >
      {row ? <RuleRowBody row={row} actions={actions} /> : null}
    </ModalSheet>
  );
}
