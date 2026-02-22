import { useCallback, useEffect, useState } from "react";

// components
import { CardBackground } from "@components/card-background";
import { Button } from "@components/button";
import CampaignListSection from "../components/campaigns/CampaignListSection";
import CampaignsHeader from "../components/campaigns/CampaignsHeader";

// hooks
import { useAuth } from "../../auth/hooks/use-auth";

// api
import { createCampaign, joinCampaign, listCampaigns } from "../api/campaigns-api";

// types
import type { CampaignCreatePayload, CampaignJoinPayload, CampaignSummary } from "../types/campaign-types";
import siteBackground from "@/assets/background/campaign_background.webp";

export default function Campaigns() {
  const { user, signOut } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await listCampaigns();
      setCampaigns(data);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to load campaigns");
      } else {
        setError("Unable to load campaigns");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleCreate = async (payload: CampaignCreatePayload) => {
    const created = await createCampaign(payload);
    setCampaigns((prev) => [created, ...prev]);
  };

  const handleJoin = async (payload: CampaignJoinPayload) => {
    const joined = await joinCampaign(payload);
    setCampaigns((prev) => [joined, ...prev]);
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
        <div className="flex justify-end">
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={signOut}
          >
            Log out
          </Button>
        </div>
        <CardBackground
          disableBackground
          className="rounded-3xl border border-border/60 bg-black/80 p-4 shadow-[0_18px_45px_rgba(6,5,4,0.45)] sm:p-6"
        >
          <CampaignsHeader
            user={user}
            onCreate={handleCreate}
            onJoin={handleJoin}
          />
        </CardBackground>
        <CampaignListSection campaigns={campaigns} isLoading={isLoading} error={error} />
      </div>
    </main>
  );
}




