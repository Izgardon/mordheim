import { useEffect, useState } from "react";

// routing
import { Outlet, useParams } from "react-router-dom";

// components
import { Button } from "@components/button";
import CampaignLayoutHeader from "../components/layout/CampaignLayoutHeader";
import CampaignSidebar from "../components/layout/CampaignSidebar";

// hooks
import { useAuth } from "../../auth/hooks/use-auth";

// api
import { getCampaign } from "../api/campaigns-api";

// types
import type { CampaignSummary } from "../types/campaign-types";

const navItems = [
  { label: "Overview", path: "" },
  { label: "My Warband", path: "warband" },
  { label: "Skills", path: "skills" },
  { label: "Wargear", path: "items" },
  { label: "House Rules", path: "house-rules" },
];

export type CampaignLayoutContext = {
  campaign: CampaignSummary | null;
};

export default function CampaignLayout() {
  const { id } = useParams();
  const { signOut } = useAuth();
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isNavOpen, setIsNavOpen] = useState(false);

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

  const canManageSettings = campaign.role === "owner" || campaign.role === "admin";

  return (
    <main className="min-h-screen bg-transparent">
      <div className="min-h-screen lg:pl-64">
        <div className="flex min-h-screen flex-col gap-6 px-6 py-10">
          <CampaignLayoutHeader onOpenNav={() => setIsNavOpen(true)} />
          <section className="flex-1">
            <Outlet context={{ campaign }} />
          </section>
        </div>
      </div>
      <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:left-0">
        <CampaignSidebar
          campaign={campaign}
          campaignId={id ?? ""}
          canManageSettings={canManageSettings}
          onSignOut={signOut}
          navItems={navItems}
          className="h-full"
        />
      </div>

      {isNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            className="absolute inset-0 bg-black/70"
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsNavOpen(false)}
          />
          <div className="relative z-10 h-full w-full max-w-[280px]">
            <CampaignSidebar
              campaign={campaign}
              campaignId={id ?? ""}
              canManageSettings={canManageSettings}
              onSignOut={signOut}
              navItems={navItems}
              onNavigate={() => setIsNavOpen(false)}
              className="h-full w-full max-w-none"
            />
            <Button
              variant="ghost"
              className="absolute right-6 top-6 text-muted-foreground hover:text-foreground"
              onClick={() => setIsNavOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}



