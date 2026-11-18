import type { CampaignCapabilities } from "../../capabilities";
import type { CampaignSummary } from "../../types/campaign-types";

export type SectionId = "campaign" | "players" | "battles" | "warband" | "feedback";

type Section = {
  id: SectionId;
  label: string;
  shown: (capabilities: CampaignCapabilities, campaign: CampaignSummary) => boolean;
};

/**
 * The settings sections in order; each shows only to those today's capabilities let use it. There
 * is no Archive row (William, 18 Nov 2026: "The archive section can just be at the bottom of the
 * campaign settings page for the owner only"): archiving, restoring and deleting for good sit at
 * the foot of Campaign, which is the owner's own section, and an archived campaign keeps it for
 * them even though every setting in it is read-only by then.
 */
const SECTIONS: Section[] = [
  {
    id: "campaign",
    label: "Campaign",
    shown: (caps) => caps.edit_settings || caps.archive || caps.restore || caps.delete,
  },
  { id: "players", label: "Players", shown: (caps) => caps.view_members },
  { id: "battles", label: "Battles", shown: (caps) => caps.manage_battles },
  { id: "warband", label: "Your warband", shown: () => true },
  { id: "feedback", label: "Feedback", shown: () => true },
];

/** The sections this viewer may open, in order. */
export function settingsSections(
  capabilities: CampaignCapabilities,
  campaign: CampaignSummary
): Section[] {
  return SECTIONS.filter((section) => section.shown(capabilities, campaign));
}

/**
 * Old links (`?tab=campaign&section=active-battles`, and `?section=archive` from the archived
 * banner and the account's deletion preview) and anything unknown land somewhere real.
 */
const MOVED: Record<string, SectionId> = { "active-battles": "battles", archive: "campaign" };

export function sectionFromUrl(params: URLSearchParams, available: Section[]): SectionId | null {
  const raw = params.get("section");
  const asked = raw === null ? null : (MOVED[raw] ?? raw);
  return available.find((section) => section.id === asked)?.id ?? null;
}
