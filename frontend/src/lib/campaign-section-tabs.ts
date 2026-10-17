import type { LucideIcon } from "lucide-react";
import { House, Map, ScrollText, Tent } from "lucide-react";

import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";

export const CAMPAIGN_SECTION_TAB_ORDER = [
  "locations",
  "encampments",
  "rules",
  "house-rules",
] as const;

export type CampaignSectionTabId = (typeof CAMPAIGN_SECTION_TAB_ORDER)[number];

export function getCampaignSectionTabs(campaign: CampaignSummary | null) {
  const tabs: {
    id: CampaignSectionTabId;
    label: string;
    icon: LucideIcon;
  }[] = [];

  if (campaign?.enable_locations) {
    tabs.push({ id: "locations", label: "Locations", icon: Map });
  }
  if (campaign?.enable_encampments) {
    tabs.push({ id: "encampments", label: "Encampments", icon: Tent });
  }

  tabs.push({ id: "rules", label: "Rules", icon: ScrollText });
  tabs.push({ id: "house-rules", label: "House Rules", icon: House });

  return tabs;
}
