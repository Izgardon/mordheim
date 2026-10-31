import { useState } from "react";
import { ChevronDown } from "lucide-react";

// components
import { Card } from "@components/card";
import { cn } from "@/lib/utils";

// types
import type { CampaignSummary } from "../../types/campaign-types";

// other
import CampaignCard from "./CampaignCard";
import { CAMPAIGN_GRID, CampaignCardsSkeleton } from "./CampaignsSkeleton";

type CampaignListSectionProps = {
  campaigns: CampaignSummary[];
  isLoading: boolean;
  error: string;
};

function CampaignGrid({ campaigns }: { campaigns: CampaignSummary[] }) {
  return (
    <div className={CAMPAIGN_GRID}>
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id} {...campaign} />
      ))}
    </div>
  );
}

/** Archived campaigns (decision 5), apart and folded until opened. */
function ArchivedCampaigns({ campaigns }: { campaigns: CampaignSummary[] }) {
  const [isOpen, setIsOpen] = useState(false);
  if (campaigns.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-4 border-t border-line pt-4">
      <button
        type="button"
        className="flex min-h-11 items-center gap-2 self-start text-sm font-bold text-text2 hover:text-head"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-0" : "-rotate-90")}
          aria-hidden="true"
        />
        {`Archived (${campaigns.length})`}
      </button>
      {isOpen ? <CampaignGrid campaigns={campaigns} /> : null}
    </div>
  );
}

/** Your campaigns (design E): the live ones as cards, the archived folded under them. */
export default function CampaignListSection({
  campaigns,
  isLoading,
  error,
}: CampaignListSectionProps) {
  const live = campaigns.filter((campaign) => !campaign.archived_at);
  const archived = campaigns.filter((campaign) => campaign.archived_at);
  return (
    <section aria-labelledby="your-campaigns" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2.5">
        <h2
          id="your-campaigns"
          className="m-0 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-faint"
        >
          Your campaigns
        </h2>
        <span className="font-mono text-xs text-faint">
          {live.length} {live.length === 1 ? "campaign" : "campaigns"}
        </span>
      </div>

      {isLoading ? (
        <CampaignCardsSkeleton />
      ) : error ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      ) : live.length === 0 && archived.length === 0 ? (
        <Card className="flex flex-col gap-2 p-6 max-[960px]:p-5">
          <h3 className="m-0 font-display text-xl font-semibold text-head">No campaigns yet</h3>
          <p className="m-0 max-w-[560px] text-sm text-text2">
            Create a campaign and share its join code with your group, or join one with the code its
            owner sent you.
          </p>
        </Card>
      ) : (
        <>
          {live.length > 0 ? (
            <CampaignGrid campaigns={live} />
          ) : (
            <p className="m-0 text-sm text-text2">Every campaign of yours is archived.</p>
          )}
          <ArchivedCampaigns campaigns={archived} />
        </>
      )}
    </section>
  );
}
