import { Link } from "react-router-dom";
import { BookOpenText, ChevronRight } from "lucide-react";

import { useCampaignScenarios } from "../api/scenario-queries";

/** The link to the Scenarios page under the overview's campaign rules: how many the list holds. */
export default function ScenariosLink({ campaignId }: { campaignId: number }) {
  const count = useCampaignScenarios(campaignId).data?.length;
  return (
    <section aria-label="Scenarios">
      <Link
        to={`/campaigns/${campaignId}/scenarios`}
        className="flex min-h-[52px] items-center gap-2.5 border-y border-line px-1 text-left no-underline"
      >
        <BookOpenText aria-hidden="true" className="h-4 w-4 shrink-0 text-accent-text" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text">
            Scenarios
          </span>
          {count ? (
            <span className="text-xs text-muted-foreground">
              {count} {count === 1 ? "scenario" : "scenarios"}
            </span>
          ) : null}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </section>
  );
}
