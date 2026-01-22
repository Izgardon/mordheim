import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../auth/hooks/use-auth";
import CampaignListSection from "../components/CampaignListSection";
import CampaignsHeader from "../components/CampaignsHeader";
import { createCampaign, joinCampaign, listCampaigns } from "../api/campaigns-api";
import type { CampaignCreatePayload, CampaignJoinPayload, CampaignSummary } from "../types/campaign-types";

export default function Campaigns() {
  const { user, isReady, signOut, token } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCampaigns = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const data = await listCampaigns(token);
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
  }, [token]);

  useEffect(() => {
    if (isReady && token) {
      loadCampaigns();
    }
  }, [isReady, loadCampaigns, token]);

  const handleCreate = async (payload: CampaignCreatePayload) => {
    if (!token) {
      return;
    }
    const created = await createCampaign(token, payload);
    setCampaigns((prev) => [created, ...prev]);
  };

  const handleJoin = async (payload: CampaignJoinPayload) => {
    if (!token) {
      return;
    }
    const joined = await joinCampaign(token, payload);
    setCampaigns((prev) => [joined, ...prev]);
  };

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <CampaignsHeader
          user={user}
          isReady={isReady}
          onCreate={handleCreate}
          onJoin={handleJoin}
          onSignOut={signOut}
        />
        <CampaignListSection campaigns={campaigns} isLoading={isLoading} error={error} />
      </div>
    </main>
  );
}
