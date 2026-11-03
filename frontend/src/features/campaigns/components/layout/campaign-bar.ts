/**
 * What the web bar's main part shows on a campaign page (William: "its main content changes
 * depending on page/urgency"): on the overview Between battles, all players (its Start battle is
 * the way back to your battle); elsewhere the most urgent of your battle to rejoin or answer,
 * Raise your warband and the archived notice; with none of those, nothing (William: "we dont need
 * the page title repeated in the top bar"), only its Campaigns and Log out.
 */
export type CampaignBarContent = "readiness" | "battle" | "raise" | "archived" | "none";

export function campaignBarContent({
  isOverview,
  readiness,
  battle,
  raise,
  archived,
}: {
  isOverview: boolean;
  /** Between battles has players to show (or is loading them). */
  readiness: boolean;
  /** You have an unfinished battle, and this isn't one of its screens. */
  battle: boolean;
  /** The page says you have no warband (`useNeedsWarband`). */
  raise: boolean;
  archived: boolean;
}): CampaignBarContent {
  if (isOverview) return readiness ? "readiness" : "none";
  if (battle) return "battle";
  if (raise) return "raise";
  if (archived) return "archived";
  return "none";
}
