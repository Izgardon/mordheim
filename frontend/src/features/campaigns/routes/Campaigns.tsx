import { useCallback, useEffect, useState } from "react";

// components
import CampaignListSection from "../components/CampaignListSection";
import CampaignsHeader from "../components/CampaignsHeader";

// hooks
import { useAuth } from "../../auth/hooks/use-auth";

// api
import { createCampaign, joinCampaign, listCampaigns } from "../api/campaigns-api";

// types
import type { CampaignCreatePayload, CampaignJoinPayload, CampaignSummary } from "../types/campaign-types";

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
    <main className="campaigns min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <CampaignsHeader
          user={user}
          onCreate={handleCreate}
          onJoin={handleJoin}
          onSignOut={signOut}
        />
        <CampaignListSection campaigns={campaigns} isLoading={isLoading} error={error} />
      </div>
    </main>
  );
}




