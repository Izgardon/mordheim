import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

// components
import { Button } from "@components/button";
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
import siteBackground from "@/assets/background/campaign_background.webp";
import "../styles/campaigns.css";
import { getErrorMessage } from "@/lib/get-error-message";

const NO_CAMPAIGNS: CampaignSummary[] = [];

export default function Campaigns() {
  const { user, signOut } = useAuth();
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
    <main
      className="campaigns h-screen overflow-x-hidden overflow-y-auto px-4 py-8 sm:px-6 sm:py-12"
      style={{
        backgroundImage: `linear-gradient(rgba(6, 5, 4, 0.25), rgba(6, 5, 4, 0.25)), url(${siteBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-10">
        <div className="flex justify-end gap-2">
          {/* The account page: display name, password, sessions and deletion (AUTH-NEW-01). */}
          <Button asChild variant="ghost">
            <Link to="/account">Account</Link>
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={signOut}
          >
            Log out
          </Button>
        </div>
        <div className="campaign-list-shell campaign-list-shell--flat p-4 sm:p-6">
          <CampaignsHeader user={user} onCreate={handleCreate} onJoin={handleJoin} />
        </div>
        <CampaignListSection campaigns={campaigns} isLoading={list.isPending} error={error} />
        {/* The same card as Settings, without a campaign's fields (CAMP-NEW-08). */}
        <FeedbackReportCard />
      </div>
    </main>
  );
}
