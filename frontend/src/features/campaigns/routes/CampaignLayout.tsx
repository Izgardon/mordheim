import { Suspense, useCallback, useEffect, useMemo } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

// routing
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

// components
import CampaignSidebar from "../components/layout/CampaignSidebar";
import {
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
import CampaignDiceRollerMenu from "@/features/realtime/components/CampaignDiceRollerMenu";
import CampaignChatMenu from "@/features/realtime/components/CampaignChatMenu";
import NotificationsMenu from "@/features/realtime/components/NotificationsMenu";
import { useNotifications } from "@/features/realtime/hooks/useNotifications";
import { useOpenCampaignBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import {
  getBattleRouteForStatus,
  getResumableBattleForUser,
  toCurrentBattleSession,
} from "@/features/battles/utils/battle-session";

// api
import { isCampaignId, useCampaignQuery, useSetCampaign } from "../hooks/useCampaignQuery";
import { useMobileTopBarOverride } from "../hooks/useMobileTopBarOverride";
import { useMyWarbandStore } from "@/features/warbands/hooks/warband/useMyWarbandStore";
import { useAppStore } from "@/stores/app-store";

// utils

// types
import type { CampaignSummary } from "../types/campaign-types";

export type CampaignLayoutContext = {
  campaign: CampaignSummary | null;
  setMobileTopBar?: (config: Partial<MobileTopBarConfig>) => void;
  setCampaign?: Dispatch<SetStateAction<CampaignSummary | null>>;
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
  const {
    user,
    setCampaignStarted,
    currentBattleSession,
    setCurrentBattleSession,
    clearCurrentBattleSession,
  } = useAppStore();
  const {
    tradeRequestNotifications,
    battleInviteNotifications,
    battleResultRequestNotifications,
    acceptTradeNotification,
    declineTradeNotification,
    acceptBattleInviteNotification,
    declineBattleInviteNotification,
    acceptBattleResultRequestNotification,
    declineBattleResultRequestNotification,
    battleNudgeNotifications,
    goToBattleNudge,
    dismissBattleNudge,
    clearNotifications,
  } = useNotifications();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const navigate = useNavigate();
  const location = useLocation();
  const campaignId = Number(id);
  const hasCampaignId = Boolean(id);
  const campaignQuery = useCampaignQuery(campaignId);
  const campaign = campaignQuery.data ?? null;
  const setCampaign = useSetCampaign(campaignId);
  const isBattleRoute = location.pathname.includes("/battles/");
  const pathSegments = useMemo(
    () => location.pathname.split("/").filter(Boolean),
    [location.pathname]
  );
  const isCampaignOverviewRoute =
    pathSegments[0] === "campaigns" && pathSegments[1] === id && pathSegments.length === 2;
  const routeBattleId = Number(pathSegments[3] ?? "");
  const routeBattleStage = pathSegments[4] ?? "";
  const defaultMobileTitle = useMemo(() => {
    const section = pathSegments[2] ?? "overview";
    switch (section) {
      case "locations":
        return "Locations";
      case "encampments":
        return "Encampments";
      case "warband":
        return "Warband";
      case "items":
        return "Wargear";
      case "skills":
        return "Skills";
      case "spells":
        return "Spells";
      case "bestiary":
        return "Bestiary";
      case "hired-swords":
        return "Hired Swords";
      case "rules":
        return "Rules";
      case "house-rules":
        return "House Rules";
      case "settings":
        return "Settings";
      case "battles":
        return "Battle";
      default:
        return "Overview";
    }
  }, [pathSegments]);
  const backButton = useMemo(
    () => (
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
    [navigate]
  );
  const notificationsButton = useMemo(
    () => (
      <NotificationsMenu
        tradeRequestNotifications={tradeRequestNotifications}
        battleInviteNotifications={battleInviteNotifications}
        battleResultRequestNotifications={battleResultRequestNotifications}
        onAcceptTrade={acceptTradeNotification}
        onDeclineTrade={declineTradeNotification}
        onAcceptBattleInvite={acceptBattleInviteNotification}
        onDeclineBattleInvite={declineBattleInviteNotification}
        onAcceptBattleResultRequest={acceptBattleResultRequestNotification}
        onDeclineBattleResultRequest={declineBattleResultRequestNotification}
        battleNudgeNotifications={battleNudgeNotifications}
        onGoToNudge={goToBattleNudge}
        onDismissNudge={dismissBattleNudge}
        onClear={clearNotifications}
      />
    ),
    [
      battleNudgeNotifications,
      dismissBattleNudge,
      goToBattleNudge,
      acceptBattleInviteNotification,
      acceptBattleResultRequestNotification,
      acceptTradeNotification,
      battleInviteNotifications,
      battleResultRequestNotifications,
      clearNotifications,
      declineTradeNotification,
      declineBattleResultRequestNotification,
      declineBattleInviteNotification,
      tradeRequestNotifications,
    ]
  );
  const diceRollerButton = useMemo(() => <CampaignDiceRollerMenu />, []);
  const chatButton = useMemo(() => <CampaignChatMenu campaignId={campaignId} />, [campaignId]);
  const handleRejoinBattle = useCallback(() => {
    if (!currentBattleSession) {
      return;
    }

    navigate(
      `/campaigns/${currentBattleSession.campaignId}/battles/${currentBattleSession.battleId}/${getBattleRouteForStatus(currentBattleSession.status)}`
    );
  }, [currentBattleSession, navigate]);
  const showRejoinBattleButton = Boolean(currentBattleSession) && !isBattleRoute;
  const showTopBarRejoinBattleButton = showRejoinBattleButton && !isCampaignOverviewRoute;
  const desktopRejoinButton = useMemo(
    () =>
      showTopBarRejoinBattleButton ? (
        <Button
          type="button"
          variant="toolbar"
          size="sm"
          onClick={handleRejoinBattle}
          className="min-w-[9.5rem] border-[#b38b3c] bg-[#5d4719] text-[#f7e6b8] shadow-[0_0_18px_rgba(214,168,71,0.3)] hover:border-[#d6a847] hover:bg-[#7a5c1f] hover:text-[#fff3d4]"
        >
          Rejoin Battle
        </Button>
      ) : null,
    [handleRejoinBattle, showTopBarRejoinBattleButton]
  );
  const mobileRejoinButton = useMemo(
    () =>
      showTopBarRejoinBattleButton ? (
        <Button
          type="button"
          variant="toolbar"
          size="sm"
          onClick={handleRejoinBattle}
          className="min-w-0 border-[#8b6a31] bg-[#3c2e14] text-[#e8d5a3] hover:border-[#aa8540] hover:bg-[#4a3918] hover:text-[#f2e3bd]"
        >
          Rejoin
        </Button>
      ) : null,
    [handleRejoinBattle, showTopBarRejoinBattleButton]
  );
  const defaultTopBar = useMemo<MobileTopBarConfig>(
    () => ({
      title: defaultMobileTitle,
      leftSlot: backButton,
      centerSlot: mobileRejoinButton,
      rightSlot: (
        <div className="flex items-center gap-2">
          {diceRollerButton}
          {chatButton}
          {notificationsButton}
        </div>
      ),
    }),
    [
      backButton,
      chatButton,
      defaultMobileTitle,
      diceRollerButton,
      mobileRejoinButton,
      notificationsButton,
    ]
  );
  const { topBar: mobileTopBar, setMobileTopBar } = useMobileTopBarOverride(defaultTopBar);

  const campaignInProgress = campaign?.in_progress;
  useEffect(() => {
    if (campaignInProgress !== undefined) {
      setCampaignStarted(campaignInProgress);
    }
  }, [campaign?.id, campaignInProgress, setCampaignStarted]);

  useMyWarbandStore(campaign?.id ?? null);

  useEffect(() => {
    if (!isBattleRoute || Number.isNaN(routeBattleId) || !hasCampaignId) {
      return;
    }

    setCurrentBattleSession({
      battleId: routeBattleId,
      campaignId,
      status:
        routeBattleStage === "active"
          ? "active"
          : routeBattleStage === "postbattle"
            ? "postbattle"
            : "prebattle",
    });
  }, [
    campaignId,
    hasCampaignId,
    isBattleRoute,
    routeBattleId,
    routeBattleStage,
    setCurrentBattleSession,
  ]);

  // The open battles query is shared with the overview's battle panel; it refetches on focus,
  // on reconnect and when a realtime battle event invalidates it.
  const openBattlesQuery = useOpenCampaignBattles(campaignId, {
    enabled: !isBattleRoute && Boolean(user?.id),
  });
  const openBattles = openBattlesQuery.data;
  const sessionCampaignId = currentBattleSession?.campaignId;

  useEffect(() => {
    if (isBattleRoute) {
      return;
    }

    if (!isCampaignId(campaignId) || !user?.id) {
      if (sessionCampaignId === undefined || sessionCampaignId === campaignId) {
        clearCurrentBattleSession();
      }
      return;
    }

    // Not loaded yet, or the last load failed: keep the existing store value.
    if (!openBattles) {
      return;
    }

    const nextSession = toCurrentBattleSession(getResumableBattleForUser(openBattles, user.id));
    if (nextSession) {
      setCurrentBattleSession(nextSession);
      return;
    }
    if (sessionCampaignId === undefined || sessionCampaignId === campaignId) {
      clearCurrentBattleSession();
    }
  }, [
    campaignId,
    clearCurrentBattleSession,
    isBattleRoute,
    openBattles,
    sessionCampaignId,
    setCurrentBattleSession,
    user?.id,
  ]);

  // Stable unless a value changes, so the layout re-rendering (store writes, notifications)
  // doesn't re-render the page through its outlet context (PERF-19).
  const outletContext = useMemo<CampaignLayoutContext>(
    () => ({ campaign, setMobileTopBar, setCampaign, showRejoinBattleButton }),
    [campaign, setCampaign, setMobileTopBar, showRejoinBattleButton]
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
      <main className="campaigns max-h-full bg-transparent">
        <div className="mx-auto flex max-h-full max-w-6xl items-center justify-center px-6 py-10">
          <p className="text-sm text-red-600">{campaignError || "No record of that campaign."}</p>
        </div>
      </main>
    );
  }

  const content = (
    <section className="min-h-0 flex-1">
      <Suspense fallback={<RouteSkeleton />}>
        <Outlet context={outletContext} />
      </Suspense>
    </section>
  );

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
          <div className="justify-self-center">{desktopRejoinButton}</div>
          <div className="flex items-center justify-self-end gap-2 [&_.theme-heading-soft]:text-[#cfbba9]">
            {diceRollerButton}
            {chatButton}
            {notificationsButton}
          </div>
        </div>
      }
    >
      {content}
    </AppShell>
  );
}
