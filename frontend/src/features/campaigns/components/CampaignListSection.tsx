import { Card } from "../../../components/ui/card";
import CampaignCard from "./CampaignCard";
import type { CampaignSummary } from "../types/campaign-types";

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
    <section className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-500">My campaigns</h2>
        <span className="text-sm text-slate-500">
          {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Gathering the chronicles...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : campaigns.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-slate-600">
            No campaigns yet. Raise a banner or join with a code.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} {...campaign} />
          ))}
        </div>
      )}
    </section>
  );
}
