import { Suspense, useMemo } from "react";
import type { ReactNode } from "react";

// routing
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

// components
import ArchivedBanner from "../components/layout/ArchivedBanner";
import CampaignLoadError from "../components/layout/CampaignLoadError";
import CampaignSidebar from "../components/layout/CampaignSidebar";
import CampaignTopBarActions from "../components/layout/CampaignTopBarActions";
import RejoinBattleButton from "../components/layout/RejoinBattleButton";
import {
  campaignSectionTitle,
  getCampaignNavItems,
  getMobileCampaignPath,
  getMobileNavActiveId,
} from "../components/layout/campaign-nav";
import { MobileTopBar } from "@/layouts/mobile";
import AppShell from "@/layouts/shell/AppShell";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { RouteSkeleton } from "@/components/ui/route-skeleton";
import { Button } from "@/components/ui/button";
import WarbandMobileNav from "@/features/warbands/components/warband/WarbandMobileNav";
import { useMediaQuery } from "@/lib/use-media-query";
import { getErrorMessage } from "@/lib/get-error-message";
import { ChevronLeft } from "lucide-react";

// hooks
import { isCampaignId, useCampaignQuery } from "../hooks/useCampaignQuery";
import { useArchivedRefusals } from "../hooks/useArchivedRefusals";
import { useBattleSession } from "../hooks/useBattleSession";
import { useMobileTopBarOverride } from "../hooks/useMobileTopBarOverride";
import { useMyWarbandStore } from "@/features/warbands/hooks/warband/useMyWarbandStore";

// types
import type { CampaignSummary } from "../types/campaign-types";

/**
 * What the layout shares with every campaign page. It owns the campaign query (pages read the
 * campaign from here, and `useUpdateCampaign` writes answers back into it) and the open battles
 * query (Rejoin Battle).
 */
export type CampaignLayoutContext = {
  campaign: CampaignSummary | null;
  setMobileTopBar?: (config: Partial<MobileTopBarConfig>) => void;
  showRejoinBattleButton?: boolean;
};

export type MobileTopBarConfig = {
  title: string;
  leftSlot?: ReactNode;
  titleInlineAfter?: ReactNode;
  centerSlot?: ReactNode;
  rightSlot?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export default function CampaignLayout() {
  const { id } = useParams();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const navigate = useNavigate();
  const location = useLocation();
  const campaignId = Number(id);
  const campaignQuery = useCampaignQuery(campaignId);
  const campaign = campaignQuery.data ?? null;
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const isBattleRoute = location.pathname.includes("/battles/");
  const isOverviewRoute =
    pathSegments[0] === "campaigns" && pathSegments[1] === id && pathSegments.length === 2;
  const { canRejoinBattle: showRejoinBattleButton, rejoinBattle } = useBattleSession(campaignId, {
    isBattleRoute,
    battleId: Number(pathSegments[3] ?? ""),
    stage: pathSegments[4] ?? "",
  });
  // The overview shows its own Rejoin Battle in the battle panel.
  const showTopBarRejoin = showRejoinBattleButton && !isOverviewRoute;
  const mobileTitle = campaignSectionTitle(location.pathname);

  const topBarActions = useMemo(
    () => <CampaignTopBarActions campaignId={campaignId} />,
    [campaignId]
  );
  const defaultTopBar = useMemo<MobileTopBarConfig>(
    () => ({
      title: mobileTitle,
      leftSlot: (
        <Button
          type="button"
          onClick={() => navigate(-1)}
          variant="icon"
          size="icon"
          className="h-9 w-9"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
      ),
      centerSlot: showTopBarRejoin ? <RejoinBattleButton compact onClick={rejoinBattle} /> : null,
      rightSlot: <div className="flex items-center gap-2">{topBarActions}</div>,
    }),
    [mobileTitle, navigate, rejoinBattle, showTopBarRejoin, topBarActions]
  );
  const { topBar: mobileTopBar, setMobileTopBar } = useMobileTopBarOverride(defaultTopBar);

  useMyWarbandStore(campaign?.id ?? null);
  useArchivedRefusals(campaignId);

  // Stable unless a value changes, so the layout re-rendering (store writes, notifications)
  // doesn't re-render the page through its outlet context (PERF-19).
  const outletContext = useMemo<CampaignLayoutContext>(
    () => ({ campaign, setMobileTopBar, showRejoinBattleButton }),
    [campaign, setMobileTopBar, showRejoinBattleButton]
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

  const mobileShell = isBattleRoute
    ? { topBarOffset: "0px", contentClassName: "pt-0 pb-0" }
    : {
        mobileTopBar: <MobileTopBar {...mobileTopBar} position="sticky" />,
        topBarOffset: mobileTopBar.meta
          ? "calc(env(safe-area-inset-top, 0px) + 7rem)"
          : "calc(env(safe-area-inset-top, 0px) + 4.25rem)",
        bottomNav: (
          <WarbandMobileNav
            activeId={getMobileNavActiveId(location.pathname)}
            onSelect={(navId) => {
              if (navId === "overview") navigate(`/campaigns/${id}`);
              else if (navId === "loadout") navigate(`/campaigns/${id}/items`);
              else if (navId === "warband") navigate(`/campaigns/${id}/warband`);
              else if (navId === "campaign") navigate(getMobileCampaignPath(campaign, id ?? ""));
              else if (navId === "settings") navigate(`/campaigns/${id}/settings`);
            }}
          />
        ),
      };

  // One shell for both breakpoints, so a viewport change never remounts the page (BUG-23).
  return (
    <AppShell
      variant={isMobile ? "mobile" : "desktop"}
      campaignId={campaignId}
      {...(isMobile ? mobileShell : {})}
      navbar={
        <CampaignSidebar
          campaign={campaign}
          campaignId={id ?? ""}
          navItems={getCampaignNavItems(campaign)}
          className="h-full w-full"
        />
      }
      desktopTopBar={
        <div className="shell-topbar grid h-full grid-cols-[1fr_auto_1fr] items-center gap-4 px-6">
          <div />
          <div className="justify-self-center">
            {showTopBarRejoin ? <RejoinBattleButton onClick={rejoinBattle} /> : null}
          </div>
          <div className="flex items-center justify-self-end gap-2 [&_.theme-heading-soft]:text-[#cfbba9]">
            {topBarActions}
          </div>
        </div>
      }
    >
      <section className="min-h-0 flex-1">
        <ArchivedBanner campaign={campaign} />
        <Suspense fallback={<RouteSkeleton />}>
          <Outlet context={outletContext} />
        </Suspense>
      </section>
    </AppShell>
  );
}
