import { Suspense, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useSearchShortcut } from "@/features/search/useSearchShortcut";
import { useMyWarbandStore } from "@/features/warbands/hooks/warband/useMyWarbandStore";
import BattleToolsBar, { type BattleMenuAction } from "@/layouts/battle/BattleToolsBar";
import BattleTopBar from "@/layouts/battle/BattleTopBar";
import CampaignBottomNav from "@/layouts/mobile/CampaignBottomNav";
import MobileTopBar from "@/layouts/mobile/MobileTopBar";
import AppShell from "@/layouts/shell/AppShell";
import CampaignPageSkeleton from "@/layouts/shell/CampaignPageSkeleton";
import CampaignTools, { type CampaignTool } from "@/layouts/shell/CampaignTools";
import NavRail from "@/layouts/shell/NavRail";
import ShellSkeleton from "@/layouts/shell/ShellSkeleton";
import { campaignSectionTitle, isBattlePath } from "@/layouts/shell/campaign-nav";
import { getErrorMessage } from "@/lib/get-error-message";
import { useMediaQuery } from "@/lib/use-media-query";

import { isArchived } from "../capabilities";
import CampaignBar from "../components/layout/CampaignBar";
import CampaignBattleDialog from "../components/layout/CampaignBattleDialog";
import CampaignLoadError from "../components/layout/CampaignLoadError";
import CampaignPageNotices from "../components/layout/CampaignPageNotices";
import { useArchivedRefusals } from "../hooks/useArchivedRefusals";
import { useBattleSession } from "../hooks/useBattleSession";
import { isCampaignId, useCampaignQuery } from "../hooks/useCampaignQuery";

import type { BattleDialogMode } from "../hooks/overview/useStartBattleForm";
import type { CampaignSummary } from "../types/campaign-types";

/**
 * What the layout shares with every campaign page. It owns the campaign query (pages read the
 * campaign from here, and `useUpdateCampaign` writes answers back into it). A battle page puts its
 * actions in the phone's battle Menu with `setBattleMenuActions`, and opens the shell's dice, chat
 * and notifications with `openTool` (the battle screen's own menu).
 */
export type CampaignLayoutContext = {
  campaign: CampaignSummary | null;
  setBattleMenuActions: (actions: BattleMenuAction[]) => void;
  openTool: (tool: CampaignTool) => void;
  /** Opens Start battle or Report a result (the layout holds the one dialog). */
  openBattleDialog: (mode: BattleDialogMode) => void;
};

/**
 * The campaign shell (design E): the web bar and the nav rail on the web; top bar and bottom nav
 * on a phone. The campaign's notices (your battle, Raise your warband, archived) sit in the web
 * bar, or in the page's flow on a phone.
 */
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
  const isBattleRoute = isBattlePath(pathname);
  const isOverview = segments.length === 2;
  // The Aftermath and the battle screen bring their own header and
  // footer on a phone.
  const ownChrome = isBattleRoute && (segments[4] === "postbattle" || segments[4] === "active");
  const { yourBattles, canRejoinBattle, rejoinBattle } = useBattleSession(campaignId, {
    isBattleRoute,
    battleId: Number(segments[3] ?? ""),
    stage: segments[4] ?? "",
  });
  const [openTool, setOpenTool] = useState<CampaignTool | null>(null);
  const [battleMenuActions, setBattleMenuActions] = useState<BattleMenuAction[]>([]);
  const [battleDialog, setBattleDialog] = useState<BattleDialogMode | null>(null);
  useSearchShortcut(campaignId, !isMobile && isCampaignId(campaignId));

  // Read alongside the campaign rather than after it: the campaign, your warband and its sheet
  // were three round trips in a row on every campaign page.
  useMyWarbandStore(isCampaignId(campaignId) ? campaignId : null);
  useArchivedRefusals(campaignId);

  // Stable unless a value changes, so the layout re-rendering (store writes, notifications)
  // doesn't re-render the page through its outlet context (PERF-19).
  const outletContext = useMemo<CampaignLayoutContext>(
    () => ({
      campaign,
      setBattleMenuActions,
      openTool: setOpenTool,
      openBattleDialog: setBattleDialog,
    }),
    [campaign]
  );

  const campaignError = !isCampaignId(campaignId)
    ? "Invalid campaign id."
    : campaignQuery.error
      ? getErrorMessage(campaignQuery.error, "Unable to load campaign")
      : "";

  // The shell and the page as skeletons: the full-screen loader is for the app's boot only.
  if (!campaignError && campaignQuery.isPending) {
    return (
      <ShellSkeleton>
        <CampaignPageSkeleton pathname={pathname} />
      </ShellSkeleton>
    );
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
  const mobileChrome = ownChrome
    ? { bottomNav: tools }
    : isBattleRoute
      ? {
          topBar: (
            <BattleTopBar
              kicker={campaign.name}
              title={segments[4] === "prebattle" ? "Before the battle" : "Battle"}
              onBack={backToCampaign}
            />
          ),
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
              onStartBattle={
                isArchived(campaign) ? undefined : () => setBattleDialog("start_battle")
              }
            />
          ),
        };

  // One shell for both breakpoints, so a viewport change never remounts the page (BUG-23).
  return (
    <AppShell
      variant={isMobile ? "mobile" : "desktop"}
      campaignId={campaignId}
      webBar={
        isMobile ? null : (
          <CampaignBar
            campaign={campaign}
            pathname={pathname}
            battles={isBattleRoute ? [] : yourBattles}
            isOverview={isOverview}
          />
        )
      }
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
      <CampaignPageNotices
        campaign={campaign}
        pathname={pathname}
        battles={yourBattles}
        isMobile={isMobile}
        isOverview={isOverview}
        isBattleRoute={isBattleRoute}
      />
      <Suspense fallback={<CampaignPageSkeleton pathname={pathname} />}>
        <Outlet context={outletContext} />
      </Suspense>
      {/* not on a battle's own screens, which open neither (and read no open battles) */}
      {isBattleRoute ? null : (
        <CampaignBattleDialog
          campaignId={campaign.id}
          mode={battleDialog}
          onClose={() => setBattleDialog(null)}
        />
      )}
    </AppShell>
  );
}
