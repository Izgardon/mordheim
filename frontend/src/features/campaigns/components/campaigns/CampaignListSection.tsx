import { useState } from "react";
import { ChevronDown } from "lucide-react";

// components
import { SectionHead } from "@components/section-title";
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
      <SectionHead
        id="your-campaigns"
        title="Your campaigns"
        aside={
          <span className="text-[13px] text-faint">
            {live.length} {live.length === 1 ? "campaign" : "campaigns"}
          </span>
        }
      />

      {isLoading ? (
        <CampaignCardsSkeleton />
      ) : error ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      ) : live.length === 0 && archived.length === 0 ? (
        <p className="m-0 text-sm text-text2">No campaigns yet.</p>
      ) : (
        <>
          {live.length > 0 ? <CampaignGrid campaigns={live} /> : null}
          <ArchivedCampaigns campaigns={archived} />
        </>
      )}
    </section>
  );
}
