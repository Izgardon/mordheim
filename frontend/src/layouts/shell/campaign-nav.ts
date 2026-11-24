import type { LucideIcon } from "lucide-react";
import { BookOpenText, LayoutGrid, Map, Shield, Swords, Tent } from "lucide-react";

import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";

type CampaignNavFlags = Pick<CampaignSummary, "enable_locations" | "enable_encampments">;

export type NavLink = {
  label: string;
  /** Below `/campaigns/:id`; "" is the overview. */
  path: string;
  icon?: LucideIcon;
};

/**
 * The References section (William, 7 Nov 2026: "split references section into references and
 * rules"): the catalogue's pages, in the rail's order (design E), Warbands last (William, 23 Nov
 * 2026: "move warbands reference nav item to the bottom of its section").
 */
export const REFERENCE_LINKS: NavLink[] = [
  { label: "Wargear", path: "items" },
  { label: "Skills", path: "skills" },
  { label: "Spells", path: "spells" },
  { label: "Boons & Banes", path: "boons-banes" },
  { label: "Bestiary", path: "bestiary" },
  { label: "Hired swords", path: "hired-swords" },
  { label: "Dramatis personae", path: "dramatis-personae" },
  { label: "Warbands", path: "warband-templates" },
];

/** The Rules section: the rulebook, the campaign's house rules and its own campaign rules. */
export const RULES_LINKS: NavLink[] = [
  { label: "Rules", path: "rules" },
  { label: "House rules", path: "house-rules" },
  { label: "Campaign rules", path: "campaign-rules" },
];

/**
 * The rail's and the Reference sheet's two sections, References (the Search everything field at
 * its head) then Rules; on a phone they share one navbar button.
 */
export const REFERENCE_SECTIONS: { title: string; links: NavLink[] }[] = [
  { title: "References", links: REFERENCE_LINKS },
  { title: "Rules", links: RULES_LINKS },
];

export const OVERVIEW_LINK: NavLink = { label: "Overview", path: "", icon: LayoutGrid };
/** The campaign's scenarios (William, 24 Nov 2026), after Battles; a phone reaches them from the overview. */
export const SCENARIOS_LINK: NavLink = {
  label: "Scenarios",
  path: "scenarios",
  icon: BookOpenText,
};
/** Search everything's page, the field at the head of References opens. */
const SEARCH_PATH = "search";
export const BATTLES_ICON = Swords;

/**
 * "My warband": the warband, the Encampments page and the campaign's Trade locations page (William,
 * 7 Nov 2026: "clicking locations in nav takes you there"; named Trade locations on 23 Nov), the
 * last two when the campaign has them switched on.
 */
export function warbandLinks(campaign: CampaignNavFlags): NavLink[] {
  return [
    { label: "Warband", path: "warband", icon: Shield },
    ...(campaign.enable_encampments
      ? [{ label: "Encampments", path: "encampments", icon: Tent }]
      : []),
    ...(campaign.enable_locations
      ? [{ label: "Trade locations", path: "locations", icon: Map }]
      : []),
  ];
}

const SECTION_TITLES: Record<string, string> = {
  warband: "Warband",
  warbands: "Warband",
  encampments: "Encampments",
  locations: "Trade locations",
  scenarios: "Scenarios",
  settings: "Settings",
  account: "Account",
  battles: "Battle",
  [SEARCH_PATH]: "Search everything",
  ...Object.fromEntries(
    [...REFERENCE_LINKS, ...RULES_LINKS].map((link) => [link.path, link.label])
  ),
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

export type MobileNavId = "campaign" | "warband" | "battle" | "reference" | "settings";

/** Which bottom-nav item a campaign path belongs to. */
export function mobileNavActiveId(pathname: string): MobileNavId {
  const current = section(pathname);
  if (isAftermathPath(pathname)) return "warband";
  // A battle and the Battles page (where Battle leads with none to rejoin).
  if (current === "battles") return "battle";
  if (current === "settings" || current === "account") return "settings";
  if (["warband", "warbands", "encampments", "locations"].includes(current)) return "warband";
  if (current === SEARCH_PATH) return "reference";
  if (REFERENCE_SECTIONS.some(({ links }) => links.some((link) => link.path === current)))
    return "reference";
  return "campaign";
}
