import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";

import ProtectedRoute from "@/components/ProtectedRoute";
import { LoadingScreen } from "@/components/ui/loading-screen";
import AccountSkeleton from "@/features/auth/components/account/AccountSkeleton";
import CampaignsSkeleton from "@/features/campaigns/components/campaigns/CampaignsSkeleton";
import { RealtimeProvider } from "@/features/realtime/components/RealtimeProvider";
import CampaignPageSkeleton from "@/layouts/shell/CampaignPageSkeleton";
import ShellSkeleton from "@/layouts/shell/ShellSkeleton";
import SitePage from "@/layouts/shell/SitePage";

/**
 * What shows while a signed-in page's code loads: the page's frame with its skeleton (the
 * campaigns list and Account in their site bar, a campaign page in the shell), never the
 * full-screen loader, which is for the app's boot.
 */
function PageFallback() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/campaigns/")) {
    return (
      <ShellSkeleton>
        <CampaignPageSkeleton pathname={pathname} />
      </ShellSkeleton>
    );
  }
  if (pathname.startsWith("/account")) {
    return (
      <SitePage width="narrow">
        <AccountSkeleton />
      </SitePage>
    );
  }
  if (pathname.startsWith("/campaigns")) {
    return (
      <SitePage>
        <CampaignsSkeleton />
      </SitePage>
    );
  }
  return <LoadingScreen />;
}

/**
 * One layout above every signed-in route, so moving between the campaigns list and a campaign
 * keeps the auth gate and the realtime subscriptions mounted instead of rebuilding them.
 */
export default function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <RealtimeProvider>
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </RealtimeProvider>
    </ProtectedRoute>
  );
}
