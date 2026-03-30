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
      <div className="space-y-4 rounded-3xl border border-border/60 bg-black/80 p-4 shadow-[0_18px_45px_rgba(6,5,4,0.45)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="theme-heading-soft text-xl font-bold">My Campaigns</h2>
          <span className="text-xs text-muted-foreground sm:text-sm">
            {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
          </span>
        </div>

        {isLoading ? (
          <CardSkeleton count={4} columns={2} />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : campaigns.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
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





