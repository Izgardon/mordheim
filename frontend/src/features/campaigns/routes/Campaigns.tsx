import { useQueryClient } from "@tanstack/react-query";

// components
import SitePage from "@/layouts/shell/SitePage";
import CampaignListSection from "../components/campaigns/CampaignListSection";
import CampaignsHeader from "../components/campaigns/CampaignsHeader";
import FeedbackReportCard from "../components/settings/FeedbackReportCard";

// hooks
import { useAuth } from "../../auth/hooks/use-auth";
import { addToCampaignList, useCampaignList } from "../hooks/useCampaignList";

// api
import { createCampaign, joinCampaign } from "../api/campaigns-api";

// types
import type {
  CampaignCreatePayload,
  CampaignJoinPayload,
  CampaignSummary,
} from "../types/campaign-types";
import { getErrorMessage } from "@/lib/get-error-message";

const NO_CAMPAIGNS: CampaignSummary[] = [];

/** Your campaigns (design E): join or create one, open one, and send feedback. */
export default function Campaigns() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const list = useCampaignList();
  const campaigns = list.data ?? NO_CAMPAIGNS;
  const error = list.error ? getErrorMessage(list.error, "Unable to load campaigns") : "";

  const handleCreate = async (payload: CampaignCreatePayload) => {
    addToCampaignList(queryClient, await createCampaign(payload));
  };

  const handleJoin = async (payload: CampaignJoinPayload) => {
    addToCampaignList(queryClient, await joinCampaign(payload));
  };

  return (
    <SitePage>
      <CampaignsHeader user={user} onCreate={handleCreate} onJoin={handleJoin} />
      <CampaignListSection campaigns={campaigns} isLoading={list.isPending} error={error} />
      {/* The same card as Settings, without a campaign's fields (CAMP-NEW-08). */}
      <div className="border-t border-line pt-8">
        <div className="max-w-[560px]">
          <FeedbackReportCard />
        </div>
      </div>
    </SitePage>
  );
}
