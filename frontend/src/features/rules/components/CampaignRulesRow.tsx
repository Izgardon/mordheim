import { useState } from "react";
import { Link } from "react-router-dom";
import { ScrollText } from "lucide-react";

import { Chip } from "@/components/ui/chip";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { cn } from "@/lib/utils";

import { useCampaignRules } from "../api/rule-queries";

const scrollTo = (node: HTMLElement | null) => node?.scrollIntoView?.({ block: "nearest" });

/**
 * The campaign rules under the overview's info bar, as a warband's own rules sit under its sheet's
 * (William, 8 Nov 2026: "lets move the campaign rules underneath the info bar like in the warband
 * page but on overview"): Campaign rules opens them all in a modal (a bottom sheet on a phone), a
 * rule's pill opens it at that rule, and Edit (`manage_campaign_rules`) goes to the Campaign rules
 * page. Nothing while there are none.
 */
export default function CampaignRulesRow({
  campaignId,
  campaignName,
  canManage,
}: {
  campaignId: number;
  campaignName: string;
  canManage: boolean;
}) {
  const rules = useCampaignRules(campaignId).data ?? [];
  const [open, setOpen] = useState(false);
  const [openedId, setOpenedId] = useState<number | null>(null);
  if (!rules.length) return null;
  const show = (ruleId: number | null) => {
    setOpenedId(ruleId);
    setOpen(true);
  };

  return (
    <section aria-label="Campaign rules" className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => show(null)}
        className="mr-1 inline-flex min-h-[34px] items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text hover:text-accent-hi"
      >
        <ScrollText aria-hidden="true" className="h-4 w-4" />
        Campaign rules
      </button>
      {rules.map((rule) => (
        <Chip key={rule.id} onClick={() => show(rule.id)}>
          {rule.title}
        </Chip>
      ))}
      {canManage ? (
        <Link
          to={`/campaigns/${campaignId}/campaign-rules`}
          className="ml-auto inline-flex min-h-[34px] items-center text-[13px] font-semibold text-accent-text"
        >
          Edit
        </Link>
      ) : null}
      <ModalSheet
        open={open}
        onOpenChange={setOpen}
        kicker={campaignName}
        title="Campaign rules"
        className="max-w-[720px]"
        closeButton
      >
        <div className="flex flex-col">
          {rules.map((rule) => (
            <article
              key={rule.id}
              ref={rule.id === openedId ? scrollTo : undefined}
              aria-label={rule.title}
              data-opened={rule.id === openedId || undefined}
              className={cn(
                "flex flex-col gap-1 border-t border-line px-3 py-3 first:border-t-0",
                rule.id === openedId && "bg-accent-soft"
              )}
            >
              <h3 className="m-0 font-bold text-head">{rule.title}</h3>
              {rule.body ? (
                <p className="m-0 whitespace-pre-line text-sm text-text2">{rule.body}</p>
              ) : null}
            </article>
          ))}
        </div>
      </ModalSheet>
    </section>
  );
}
