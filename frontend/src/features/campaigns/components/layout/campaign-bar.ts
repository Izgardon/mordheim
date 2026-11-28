/**
 * What the web bar's main part shows on a campaign page (William: "its main content changes
 * depending on page/urgency"): on the overview Between battles, all players (its Start battle is
 * the way back to your battle); on your warband page with your post-game open, its steps (William,
 * 28 Nov 2026: "so the steps are always in the top line"); elsewhere the most urgent of your
 * battle to rejoin or answer,
 * Raise your warband and the archived notice; with none of those, nothing (William: "we dont need
 * the page title repeated in the top bar"), only its Campaigns and Log out.
 */
export type CampaignBarContent =
  | "readiness"
  | "postgame"
  | "battle"
  | "raise"
  | "archived"
  | "none";

export function campaignBarContent({
  isOverview,
  readiness,
  postgame,
  battle,
  raise,
  archived,
}: {
  isOverview: boolean;
  /** Between battles has players to show (or is loading them). */
  readiness: boolean;
  /** This is your warband page, and one of your unfinished battles is your post-game. */
  postgame: boolean;
  /** You have an unfinished battle, and this isn't one of its screens. */
  battle: boolean;
  /** The page says you have no warband (`useNeedsWarband`). */
  raise: boolean;
  archived: boolean;
}): CampaignBarContent {
  if (isOverview) return readiness ? "readiness" : "none";
  if (postgame) return "postgame";
  if (battle) return "battle";
  if (raise) return "raise";
  if (archived) return "archived";
  return "none";
}

/** Your own warband's page, `/campaigns/:id/warband` (someone else's is `warbands/:id`). */
export const isOwnWarbandPage = (pathname: string) =>
  /^\/campaigns\/\d+\/warband\/?$/.test(pathname);
