import { useOutletContext } from "react-router-dom";

import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import Warband from "@/features/warbands/routes/Warband";

import WorkshopList from "../components/WorkshopList";

/** A workshop's page: the warband page for its warband, or its list. */
export default function WorkshopPage() {
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  if (!campaign) return null;
  return campaign.holds === "list" ? <WorkshopList workshop={campaign} /> : <Warband />;
}
