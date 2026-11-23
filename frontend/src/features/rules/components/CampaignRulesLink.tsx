import { Link } from "react-router-dom";
import { ChevronRight, ScrollText } from "lucide-react";

import { useCampaignCharts, useCampaignRules } from "../api/rule-queries";

const count = (many: number, one: string) => `${many} ${many === 1 ? one : `${one}s`}`;

/**
 * The link to the Campaign rules page under the overview's info bar (William, 19 Nov 2026: "in
 * campaign page let us just link to that page rather than show the rules there"). It says how much
 * is there so the player knows whether it is worth opening; nothing while the campaign has none and
 * the reader cannot add any.
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
  const campaignRules = rules.filter((rule) => rule.kind === "campaign").length;
  const battleRules = rules.length - campaignRules;
  if (!rules.length && !charts.length && !canManage) return null;
  const held = [
    campaignRules ? count(campaignRules, "campaign rule") : "",
    battleRules ? count(battleRules, "battle rule") : "",
    charts.length ? count(charts.length, "table") : "",
  ].filter(Boolean);

  return (
    <section aria-label="Campaign rules and tables">
      <Link
        to={`/campaigns/${campaignId}/campaign-rules`}
        className="flex min-h-[52px] items-center gap-2.5 border-y border-line px-1 text-left no-underline"
      >
        <ScrollText aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-text" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text">
            Campaign rules
          </span>
          {held.length ? (
            <span className="text-xs text-muted-foreground">{held.join(" · ")}</span>
          ) : null}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </section>
  );
}
