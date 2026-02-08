import { useCallback, useEffect, useState } from "react";

// routing
import { Outlet, useParams } from "react-router-dom";

// components
import CampaignSidebar from "../components/layout/CampaignSidebar";
import { DesktopLayout } from "@/layouts/desktop";
import { LoadingScreen } from "@/components/ui/loading-screen";

// api
import { getCampaign } from "../api/campaigns-api";
import { getWarband, getWarbandSummary } from "@/features/warbands/api/warbands-api";
import { useAppStore } from "@/stores/app-store";

// utils

// types
import type { CampaignSummary } from "../types/campaign-types";

const navItems = [
  { label: "Overview", path: "" },
  { label: "My Warband", path: "warband" },
  { label: "Skills", path: "skills" },
  { label: "Spells", path: "spells" },
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
  const { setWarband, setWarbandLoading, setWarbandError, setCampaignStarted } = useAppStore();
  const campaignId = Number(id);

  useEffect(() => {
    if (!id) {
      return;
    }

    if (Number.isNaN(campaignId)) {
      setError("Invalid campaign id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    getCampaign(campaignId)
      .then((data) => {
        setCampaign(data);
        setCampaignStarted(data?.in_progress ?? false);
      })
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load campaign");
        } else {
          setError("Unable to load campaign");
        }
      })
      .finally(() => setIsLoading(false));
  }, [campaignId, id]);

  const loadWarband = useCallback(async () => {
    if (!campaign) {
      setWarband(null);
      setWarbandError("");
      setWarbandLoading(false);
      return;
    }

    setWarbandLoading(true);
    setWarbandError("");

    try {
      const warband = await getWarband(campaign.id);
      if (warband) {
        const summary = await getWarbandSummary(warband.id);
        setWarband(summary);
      } else {
        setWarband(null);
      }
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setWarbandError(errorResponse.message || "Unable to load warband");
      } else {
        setWarbandError("Unable to load warband");
      }
    } finally {
      setWarbandLoading(false);
    }
  }, [campaign, setWarband, setWarbandError, setWarbandLoading]);

  useEffect(() => {
    loadWarband();
  }, [loadWarband]);

  useEffect(() => {
    const handleWarbandUpdate = () => {
      loadWarband();
    };
    window.addEventListener("warband:updated", handleWarbandUpdate);
    return () => {
      window.removeEventListener("warband:updated", handleWarbandUpdate);
    };
  }, [loadWarband]);

  if (isLoading) {
    return <LoadingScreen message="Preparing the campaign..." />;
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
      <section className="min-h-0 flex-1">
        <Outlet context={{ campaign }} />
      </section>
    </DesktopLayout>
  );
}



