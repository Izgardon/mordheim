// components
import { Card } from "@components/card";
import { CardSkeleton } from "@components/card-skeleton";
import { CardBackground } from "@components/card-background";
import { useMediaQuery } from "@/lib/use-media-query";

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
  const isMobile = useMediaQuery("(max-width: 960px)");
  return (
    <section className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: '#a78f79' }}>My Campaigns</h2>
        <span className="text-sm text-muted-foreground">
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
        <div className="grid gap-6 md:grid-cols-2">
          {campaigns.map((campaign) =>
            isMobile ? (
              <CampaignCard key={campaign.id} {...campaign} />
            ) : (
              <CardBackground key={campaign.id} className="rounded-3xl p-1">
                <CampaignCard {...campaign} />
              </CardBackground>
            )
          )}
        </div>
      )}
    </section>
  );
}





