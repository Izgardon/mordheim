import { useState } from "react";
import { ChevronDown } from "lucide-react";

// components
import { Card } from "@components/card";
import { CardSkeleton } from "@components/card-skeleton";

// types
import type { CampaignSummary } from "../../types/campaign-types";

// other
import CampaignCard from "./CampaignCard";

type CampaignListSectionProps = {
  campaigns: CampaignSummary[];
  isLoading: boolean;
  error: string;
};

function CampaignGrid({ campaigns }: { campaigns: CampaignSummary[] }) {
  return (
    <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
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
    <div className="space-y-4 border-t border-line pt-4">
      <button
        type="button"
        className="flex items-center gap-2 text-sm font-semibold text-text2 hover:text-head"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
          aria-hidden="true"
        />
        {`Archived (${campaigns.length})`}
      </button>
      {isOpen ? <CampaignGrid campaigns={campaigns} /> : null}
    </div>
  );
}

export default function CampaignListSection({
  campaigns,
  isLoading,
  error,
}: CampaignListSectionProps) {
  const live = campaigns.filter((campaign) => !campaign.archived_at);
  const archived = campaigns.filter((campaign) => campaign.archived_at);
  return (
    <section className="flex-1">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold text-head">My campaigns</h2>
          <span className="text-sm text-muted-foreground">
            {live.length} {live.length === 1 ? "campaign" : "campaigns"}
          </span>
        </div>

        {isLoading ? (
          <CardSkeleton count={4} columns={2} />
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : live.length === 0 && archived.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-text2">
              No campaigns yet. Raise a banner or join with a code.
            </p>
          </Card>
        ) : (
          <>
            {live.length > 0 ? <CampaignGrid campaigns={live} /> : null}
            <ArchivedCampaigns campaigns={archived} />
          </>
        )}
      </div>
    </section>
  );
}
