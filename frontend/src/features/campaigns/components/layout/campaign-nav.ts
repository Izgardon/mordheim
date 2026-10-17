import {
  Book,
  Castle,
  House,
  Map,
  PawPrint,
  ScrollText,
  Shield,
  Sparkles,
  Sword,
  Swords,
  Tent,
} from "lucide-react";

import type { CampaignSummary } from "../../types/campaign-types";

type CampaignNavFlags = Pick<CampaignSummary, "enable_locations" | "enable_encampments">;

/** The desktop rail's links. */
export function getCampaignNavItems(campaign: CampaignNavFlags) {
  return [
    { label: "Campaign", path: "", icon: Castle },
    { label: "Warband", path: "warband", icon: Swords },
    { label: "Skills", path: "skills", icon: Book },
    { label: "Spells", path: "spells", icon: Sparkles },
    { label: "Wargear", path: "items", icon: Shield },
    { label: "Bestiary", path: "bestiary", icon: PawPrint },
    { label: "Hired Swords", path: "hired-swords", icon: Sword },
    ...(campaign.enable_locations ? [{ label: "Locations", path: "locations", icon: Map }] : []),
    ...(campaign.enable_encampments
      ? [{ label: "Encampments", path: "encampments", icon: Tent }]
      : []),
    { label: "Rules", path: "rules", icon: ScrollText },
    { label: "House Rules", path: "house-rules", icon: House },
  ];
}

/** Where the mobile nav's "Campaign" tab goes: the first campaign section that is switched on. */
export function getMobileCampaignPath(campaign: CampaignNavFlags, campaignId: string) {
  if (campaign.enable_locations) return `/campaigns/${campaignId}/locations`;
  if (campaign.enable_encampments) return `/campaigns/${campaignId}/encampments`;
  return `/campaigns/${campaignId}/rules`;
}

export function getMobileNavActiveId(path: string) {
  if (path.includes("/battles/")) return "overview" as const;
  if (path.includes("/settings")) return "settings" as const;
  if (
    path.includes("/locations") ||
    path.includes("/encampments") ||
    path.includes("/rules") ||
    path.includes("/house-rules")
  ) {
    return "campaign" as const;
  }
  if (path.includes("/warband")) return "warband" as const;
  if (
    path.includes("/items") ||
    path.includes("/skills") ||
    path.includes("/spells") ||
    path.includes("/bestiary") ||
    path.includes("/hired-swords")
  ) {
    return "loadout" as const;
  }
  return "overview" as const;
}
