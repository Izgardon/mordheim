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

export default function CampaignListSection({
  campaigns,
  isLoading,
  error,
}: CampaignListSectionProps) {
  return (
    <section className="flex-1">
      <div className="campaign-list-shell space-y-4 rounded-3xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="theme-heading-soft text-xl font-bold text-[#f0dfbc]">My Campaigns</h2>
          <span className="text-xs text-[#b9a58a] sm:text-sm">
            {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
          </span>
        </div>

        {isLoading ? (
          <CardSkeleton count={4} columns={2} />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : campaigns.length === 0 ? (
          <Card className="campaign-ornate-card p-6">
            <p className="text-sm text-[#c8b59a]">
              No campaigns yet. Raise a banner or join with a code.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} {...campaign} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}





