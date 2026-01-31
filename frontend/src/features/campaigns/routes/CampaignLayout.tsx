import { useEffect, useState } from "react";

// routing
import { Outlet, useParams } from "react-router-dom";

// components
import CampaignSidebar from "../components/layout/CampaignSidebar";
import { DesktopLayout } from "@/layouts/desktop";


// api
import { getCampaign } from "../api/campaigns-api";

// types
import type { CampaignSummary } from "../types/campaign-types";

const navItems = [
  { label: "Overview", path: "" },
  { label: "My Warband", path: "warband" },
  { label: "Skills", path: "skills" },
  { label: "Wargear", path: "items" },
  { label: "Rules", path: "rules" },
  { label: "House Rules", path: "house-rules" },
];

export type CampaignLayoutContext = {
  campaign: CampaignSummary | null;
};

export default function CampaignLayout() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
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

    getCampaign(campaignId)
      .then((data) => setCampaign(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load campaign");
        } else {
          setError("Unable to load campaign");
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <main className="campaigns max-h-full bg-transparent">
        <div className="mx-auto flex max-h-full max-w-6xl items-center justify-center px-6 py-10">
          <p className="text-sm text-muted-foreground">Reading the chronicle...</p>
        </div>
      </main>
    );
  }

  if (error || !campaign) {
    return (
      <main className="campaigns max-h-full bg-transparent">
        <div className="mx-auto flex max-h-full max-w-6xl items-center justify-center px-6 py-10">
          <p className="text-sm text-red-600">{error || "No record of that campaign."}</p>
        </div>
      </main>
    );
  }

  return (
    <DesktopLayout
      navbar={
        <CampaignSidebar
          campaign={campaign}
          campaignId={id ?? ""}
          navItems={navItems}
          className="h-full w-full"
        />
      }
    >
      <section className="flex-1">
        <Outlet context={{ campaign }} />
      </section>
    </DesktopLayout>
  );
}



