import { Suspense, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

import { LoadingScreen } from "@/components/ui/loading-screen";
import { RouteSkeleton } from "@/components/ui/route-skeleton";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useMyWarbandStore } from "@/features/warbands/hooks/warband/useMyWarbandStore";
import BattleToolsBar, { type BattleMenuAction } from "@/layouts/battle/BattleToolsBar";
import BattleTopBar from "@/layouts/battle/BattleTopBar";
import CampaignBottomNav from "@/layouts/mobile/CampaignBottomNav";
import MobileTopBar from "@/layouts/mobile/MobileTopBar";
import AppShell from "@/layouts/shell/AppShell";
import CampaignTools, { type CampaignTool } from "@/layouts/shell/CampaignTools";
import NavRail from "@/layouts/shell/NavRail";
import { campaignSectionTitle } from "@/layouts/shell/campaign-nav";
import { getErrorMessage } from "@/lib/get-error-message";
import { useMediaQuery } from "@/lib/use-media-query";

import ArchivedBanner from "../components/layout/ArchivedBanner";
import CampaignLoadError from "../components/layout/CampaignLoadError";
import { useArchivedRefusals } from "../hooks/useArchivedRefusals";
import { useBattleSession } from "../hooks/useBattleSession";
import { isCampaignId, useCampaignQuery } from "../hooks/useCampaignQuery";

import type { CampaignSummary } from "../types/campaign-types";

/**
 * What the layout shares with every campaign page. It owns the campaign query (pages read the
 * campaign from here, and `useUpdateCampaign` writes answers back into it). A battle page puts its
 * actions in the phone's battle Menu with `setBattleMenuActions`.
 */
export type CampaignLayoutContext = {
  campaign: CampaignSummary | null;
  setBattleMenuActions: (actions: BattleMenuAction[]) => void;
};

/** The campaign shell (design E): the nav rail on the web; top bar and bottom nav on a phone. */
export default function CampaignLayout() {
  const { id } = useParams();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const campaignId = Number(id);
  const campaignQuery = useCampaignQuery(campaignId);
  const campaign = campaignQuery.data ?? null;
  const segments = pathname.split("/").filter(Boolean);
  const isBattleRoute = segments[2] === "battles";
  // The Aftermath brings its own header and footer on a phone (next step 3).
  const isAftermath = isBattleRoute && segments[4] === "postbattle";
  const { canRejoinBattle, rejoinBattle } = useBattleSession(campaignId, {
    isBattleRoute,
    battleId: Number(segments[3] ?? ""),
    stage: segments[4] ?? "",
  });
  const [openTool, setOpenTool] = useState<CampaignTool | null>(null);
  const [battleMenuActions, setBattleMenuActions] = useState<BattleMenuAction[]>([]);

  useMyWarbandStore(campaign?.id ?? null);
  useArchivedRefusals(campaignId);

  // Stable unless a value changes, so the layout re-rendering (store writes, notifications)
  // doesn't re-render the page through its outlet context (PERF-19).
  const outletContext = useMemo<CampaignLayoutContext>(
    () => ({ campaign, setBattleMenuActions }),
    [campaign]
  );

  const campaignError = !isCampaignId(campaignId)
    ? "Invalid campaign id."
    : campaignQuery.error
      ? getErrorMessage(campaignQuery.error, "Unable to load campaign")
      : "";

  if (!campaignError && campaignQuery.isPending) {
    return <LoadingScreen message="Preparing the campaign..." />;
  }

  if (!campaign) {
    return (
      <CampaignLoadError
        message={campaignError || "No record of that campaign."}
        onRetry={isCampaignId(campaignId) ? () => void campaignQuery.refetch() : undefined}
      />
    );
  }

  const userName = user?.name?.trim() || "You";
  const onRejoinBattle = canRejoinBattle ? rejoinBattle : undefined;
  const backToCampaign = () => navigate(`/campaigns/${campaign.id}`);
  const toolsLook = !isMobile ? "rail" : isBattleRoute ? "none" : "bar";
  const tools = (
    <CampaignTools
      campaignId={campaign.id}
      open={openTool}
      onOpenChange={setOpenTool}
      look={toolsLook}
    />
  );
  const mobileChrome = isAftermath
    ? { bottomNav: tools }
    : isBattleRoute
      ? {
          topBar: <BattleTopBar kicker={campaign.name} title="Battle" onBack={backToCampaign} />,
          bottomNav: (
            <>
              {tools}
              <BattleToolsBar
                actions={battleMenuActions}
                onOpenTool={setOpenTool}
                onExit={backToCampaign}
              />
            </>
          ),
        }
      : {
          topBar: (
            <MobileTopBar
              kicker={campaign.name}
              title={campaignSectionTitle(pathname)}
              tools={tools}
            />
          ),
          bottomNav: (
            <CampaignBottomNav
              campaign={campaign}
              userName={userName}
              onRejoinBattle={onRejoinBattle}
            />
          ),
        };

  // One shell for both breakpoints, so a viewport change never remounts the page (BUG-23).
  return (
    <AppShell
      variant={isMobile ? "mobile" : "desktop"}
      campaignId={campaignId}
      rail={
        <NavRail
          campaign={campaign}
          userName={userName}
          tools={tools}
          onRejoinBattle={onRejoinBattle}
        />
      }
      {...(isMobile ? mobileChrome : {})}
    >
      <ArchivedBanner campaign={campaign} />
      <Suspense fallback={<RouteSkeleton />}>
        <Outlet context={outletContext} />
      </Suspense>
    </AppShell>
  );
}
