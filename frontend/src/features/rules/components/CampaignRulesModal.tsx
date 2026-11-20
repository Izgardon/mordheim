import { ModalSheet } from "@/components/ui/modal-sheet";
import { cn } from "@/lib/utils";

import type { RuleRow } from "../campaign-rule-rows";
import ChartTable from "./ChartTable";

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
  actions?: (ruleId: number) => React.ReactNode;
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
      <div className="flex flex-col">
        {(row?.rules ?? []).map((rule, index) => (
          <section
            key={rule.id}
            // a rule under an umbrella is its own section: a rule above it, so its heading does not
            // run on from the last one's buttons (William, 20 Nov 2026)
            className={cn("flex flex-col gap-1.5", index > 0 && "mt-6 border-t border-strong pt-6")}
          >
            {row?.umbrella ? (
              <h3 className="m-0 text-[15px] font-bold text-head">{rule.title}</h3>
            ) : null}
            {rule.body ? (
              <p className="m-0 whitespace-pre-line text-[13px] text-text2">{rule.body}</p>
            ) : null}
            {rule.chart ? (
              <>
                {rule.chart.description ? (
                  <p className="m-0 whitespace-pre-line text-[13px] text-text2">
                    {rule.chart.description}
                  </p>
                ) : null}
                <ChartTable rows={rule.chart.rows} dice={rule.chart.dice} />
                {rule.chart.note ? (
                  <p className="m-0 whitespace-pre-line text-xs text-muted-foreground">
                    {rule.chart.note}
                  </p>
                ) : null}
              </>
            ) : null}
            {actions ? <div className="flex flex-wrap gap-2">{actions(rule.id)}</div> : null}
          </section>
        ))}
      </div>
    </ModalSheet>
  );
}
