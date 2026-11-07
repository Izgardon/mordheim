import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";

import { SectionHead } from "@/components/ui/section-title";
import { cn } from "@/lib/utils";

import { useCampaignRules } from "../api/rule-queries";

/**
 * The overview's Campaign rules, kept compact: each rule's title, its text opening under it on a
 * click; Edit (`manage_campaign_rules`) goes to the Campaign rules page. Nothing while there are
 * none.
 */
export default function CampaignRulesSection({
  campaignId,
  canManage,
}: {
  campaignId: number;
  canManage: boolean;
}) {
  const rules = useCampaignRules(campaignId).data ?? [];
  const [open, setOpen] = useState<number | null>(null);
  if (!rules.length) return null;
  const edit = canManage ? (
    <Link
      to={`/campaigns/${campaignId}/campaign-rules`}
      className="text-[13px] font-semibold text-accent-text"
    >
      Edit
    </Link>
  ) : null;

  return (
    <section aria-label="Campaign rules" className="flex flex-col gap-2">
      <SectionHead title="Campaign rules" aside={edit} />
      <ul className="m-0 list-none border-y border-line p-0">
        {rules.map((rule) => {
          const shown = open === rule.id;
          return (
            <li key={rule.id} className="border-t border-line first:border-t-0">
              <button
                type="button"
                aria-expanded={shown}
                onClick={() => setOpen(shown ? null : rule.id)}
                className="flex min-h-11 w-full items-center gap-2 py-2 text-left text-sm font-bold text-head"
              >
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                    shown ? "rotate-0" : "-rotate-90"
                  )}
                />
                {rule.title}
              </button>
              {shown && rule.body ? (
                <p className="m-0 whitespace-pre-line pb-3 pl-[22px] text-[13px] text-text2">
                  {rule.body}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
