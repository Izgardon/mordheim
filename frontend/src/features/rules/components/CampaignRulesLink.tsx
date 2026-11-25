import { Link } from "react-router-dom";
import { ChevronRight, ScrollText } from "lucide-react";

import { useCampaignCharts, useCampaignRules } from "../api/rule-queries";

/**
 * The link to the Campaign rules page under the overview's info bar (William, 19 Nov 2026: "in
 * campaign page let us just link to that page rather than show the rules there"), its name on one
 * line and nothing under it (William, 25 Nov 2026); nothing at all while the campaign has no rules
 * or charts and the reader cannot add any.
 */
export default function CampaignRulesLink({
  campaignId,
  canManage,
}: {
  campaignId: number;
  canManage: boolean;
}) {
  const rules = useCampaignRules(campaignId).data ?? [];
  const charts = useCampaignCharts(campaignId).data ?? [];
  if (!rules.length && !charts.length && !canManage) return null;

  return (
    <section aria-label="Campaign rules and charts">
      <Link
        to={`/campaigns/${campaignId}/campaign-rules`}
        className="flex min-h-[52px] items-center gap-2.5 border-y border-line px-1 text-left no-underline"
      >
        <ScrollText aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-text" />
        <span className="flex min-w-0 flex-1 flex-col">
          {/* one line, no counts under it (William, 25 Nov 2026) */}
          <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.08em] text-accent-text">
            Campaign rules
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </section>
  );
}
