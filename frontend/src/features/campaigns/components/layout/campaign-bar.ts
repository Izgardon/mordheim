/**
 * What the web bar's main part shows on a campaign page (William: "its main content changes
 * depending on page/urgency"): on the overview Between battles, all players (its Start battle is
 * the way back to your battle); elsewhere the most urgent of your battle to rejoin or answer,
 * Raise your warband and the archived notice; with none of those, the campaign's name and the
 * page's title.
 */
export type CampaignBarContent = "readiness" | "battle" | "raise" | "archived" | "title";

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
  if (isOverview) return readiness ? "readiness" : "title";
  if (battle) return "battle";
  if (raise) return "raise";
  if (archived) return "archived";
  return "title";
}

const BATTLE_STAGES: Record<string, string> = {
  prebattle: "Before the battle",
  active: "Battle",
  postbattle: "Aftermath",
};

/** A battle screen's title in the bar, from its stage (`battles/:id/<stage>`). */
export const battleStageTitle = (stage: string | undefined) =>
  BATTLE_STAGES[stage ?? ""] ?? "Battle";
