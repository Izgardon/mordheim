import { Suspense, useMemo } from "react";
import { Link, Navigate, Outlet, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import CampaignLoadError from "@/features/campaigns/components/layout/CampaignLoadError";
import { isCampaignId, useCampaignQuery } from "@/features/campaigns/hooks/useCampaignQuery";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import WarbandSkeleton from "@/features/warbands/components/page/WarbandSkeleton";
import SitePage from "@/layouts/shell/SitePage";
import { getErrorMessage } from "@/lib/get-error-message";

const NOTHING = () => undefined;

/** Back to Home, where the workshop's warbands and lists are listed. */
function BackHome() {
  return (
    <Link
      to="/campaigns"
      className="-mb-2 flex min-h-11 items-center gap-1 self-start text-sm font-bold text-text2 hover:text-head"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      Home
    </Link>
  );
}

/**
 * A workshop's page (apps/workshop): its warband or its list on its own, in Home's frame, with no
 * campaign shell (no rail, battles, notices or tools). The pages inside read the workshop as their
 * campaign, as a campaign's pages do; a campaign's id here goes back to the campaign.
 */
export default function WorkshopLayout() {
  const { id } = useParams();
  const workshopId = Number(id);
  const query = useCampaignQuery(workshopId);
  const workshop = query.data ?? null;
  const context = useMemo<CampaignLayoutContext>(
    () => ({
      campaign: workshop,
      setBattleMenuActions: NOTHING,
      setBattleRules: NOTHING,
      openTool: NOTHING,
      openBattleDialog: NOTHING,
    }),
    [workshop]
  );

  if (isCampaignId(workshopId) && query.isPending) {
    return (
      <SitePage>
        <BackHome />
        <WarbandSkeleton />
      </SitePage>
    );
  }
  if (!workshop) {
    return (
      <CampaignLoadError
        message={
          query.error
            ? getErrorMessage(query.error, "Unable to load it")
            : "No record of that warband or list."
        }
        onRetry={isCampaignId(workshopId) ? () => void query.refetch() : undefined}
      />
    );
  }
  if (workshop.kind !== "workshop") {
    return <Navigate to={`/campaigns/${workshop.id}`} replace />;
  }
  return (
    <SitePage>
      <BackHome />
      <Suspense fallback={<WarbandSkeleton />}>
        <Outlet context={context} />
      </Suspense>
    </SitePage>
  );
}
