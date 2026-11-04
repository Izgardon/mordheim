import type { LucideIcon } from "lucide-react";
import { LayoutGrid, Map, Search, Shield, Swords, Tent } from "lucide-react";

import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";

type CampaignNavFlags = Pick<CampaignSummary, "enable_locations" | "enable_encampments">;

export type NavLink = {
  label: string;
  /** Below `/campaigns/:id`; "" is the overview. */
  path: string;
  icon?: LucideIcon;
};

/** The reference pages, in the rail's order (design E). */
export const REFERENCE_LINKS: NavLink[] = [
  { label: "Rules", path: "rules" },
  { label: "Warbands", path: "warband-templates" },
  { label: "Wargear", path: "items" },
  { label: "Skills", path: "skills" },
  { label: "Skill groups", path: "skill-groups" },
  { label: "Spells", path: "spells" },
  { label: "Bestiary", path: "bestiary" },
  { label: "Hired swords", path: "hired-swords" },
  { label: "Dramatis personae", path: "dramatis-personae" },
  { label: "House rules", path: "house-rules" },
];

export const OVERVIEW_LINK: NavLink = { label: "Overview", path: "", icon: LayoutGrid };
/** Search everything: the rail's first Reference row, the Reference sheet's first. */
export const SEARCH_LINK: NavLink = { label: "Search everything", path: "search", icon: Search };
export const BATTLES_ICON = Swords;

/**
 * "My warband": the warband, the Encampment page and the warband page's Locations panel, the last
 * two when the campaign has them switched on.
 */
export function warbandLinks(campaign: CampaignNavFlags): NavLink[] {
  return [
    { label: "Warband", path: "warband", icon: Shield },
    ...(campaign.enable_encampments
      ? [{ label: "Encampment", path: "encampments", icon: Tent }]
      : []),
    ...(campaign.enable_locations
      ? [{ label: "Locations", path: "warband?panel=locations", icon: Map }]
      : []),
  ];
}

const SECTION_TITLES: Record<string, string> = {
  warband: "Warband",
  warbands: "Warband",
  encampments: "Encampment",
  locations: "Locations",
  settings: "Settings",
  account: "Account",
  battles: "Battle",
  search: "Search everything",
  ...Object.fromEntries(REFERENCE_LINKS.map((link) => [link.path, link.label])),
};

const parts = (pathname: string) => pathname.split("/").filter(Boolean);
const section = (pathname: string) => parts(pathname)[2] ?? "";
/** The Battles page itself (`/campaigns/:id/battles`), not one battle. */
const isBattlesPage = (pathname: string) =>
  section(pathname) === "battles" && parts(pathname).length === 3;

/**
 * One battle's screens (`battles/:id/...`), which bring the battle bar and tools on a phone; the
 * Battles page itself keeps the campaign's nav.
 */
export const isBattlePath = (pathname: string) =>
  section(pathname) === "battles" && parts(pathname).length > 3;

/** A battle's Aftermath (`battles/:id/postbattle`): part of your warband's post-game. */
export const isAftermathPath = (pathname: string) => /\/battles\/\d+\/postbattle/.test(pathname);

/** The phone's top-bar title for a campaign path (`/campaigns/:id/<section>/...`). */
export function campaignSectionTitle(pathname: string) {
  if (isBattlesPage(pathname)) return "Battles";
  return SECTION_TITLES[section(pathname)] ?? "Overview";
}

export type MobileNavId = "campaign" | "warband" | "battle" | "reference" | "me";

/** Which bottom-nav item a campaign path belongs to. */
export function mobileNavActiveId(pathname: string): MobileNavId {
  const current = section(pathname);
  if (isAftermathPath(pathname)) return "warband";
  // A battle and the Battles page (where Battle leads with none to rejoin).
  if (current === "battles") return "battle";
  if (current === "settings" || current === "account") return "me";
  if (["warband", "warbands", "encampments", "locations"].includes(current)) return "warband";
  if (current === SEARCH_LINK.path) return "reference";
  if (REFERENCE_LINKS.some((link) => link.path === current)) return "reference";
  return "campaign";
}
