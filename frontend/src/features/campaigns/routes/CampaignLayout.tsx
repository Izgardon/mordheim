import { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router-dom";

import { useAuth } from "../../auth/hooks/use-auth";
import { getCampaign } from "../api/campaigns-api";
import CampaignLayoutHeader from "../components/CampaignLayoutHeader";
import CampaignSidebar from "../components/CampaignSidebar";
import type { CampaignSummary } from "../types/campaign-types";

const navItems = [
  { label: "Chronicle", path: "" },
  { label: "My Warband", path: "warband" },
  { label: "Warbands", path: "warbands" },
  { label: "Skills", path: "skills" },
  { label: "Wargear", path: "items" },
];

export type CampaignLayoutContext = {
  campaign: CampaignSummary | null;
};

export default function CampaignLayout() {
  const { id } = useParams();
  const { token, signOut } = useAuth();
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token || !id) {
      return;
    }

    const campaignId = Number(id);
    if (Number.isNaN(campaignId)) {
      setError("Invalid campaign id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    getCampaign(token, campaignId)
      .then((data) => setCampaign(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load campaign");
        } else {
          setError("Unable to load campaign");
        }
      })
      .finally(() => setIsLoading(false));
  }, [token, id]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-transparent">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
          <p className="text-sm text-muted-foreground">Reading the chronicle...</p>
        </div>
      </main>
    );
  }

  if (error || !campaign) {
    return (
      <main className="min-h-screen bg-transparent">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10">
          <p className="text-sm text-red-600">{error || "No record of that campaign."}</p>
        </div>
      </main>
    );
  }

  const isOwner = campaign.role === "owner";

  return (
    <main className="min-h-screen bg-transparent">
      <div className="flex min-h-screen flex-col gap-6 px-6 py-10">
        <CampaignLayoutHeader onSignOut={signOut} />

        <div className="flex min-h-0 flex-1 items-stretch gap-8">
          <CampaignSidebar
            campaign={campaign}
            campaignId={id ?? ""}
            isOwner={isOwner}
            navItems={navItems}
          />
          <section className="flex-1">
            <Outlet context={{ campaign }} />
          </section>
        </div>
      </div>
    </main>
  );
}
