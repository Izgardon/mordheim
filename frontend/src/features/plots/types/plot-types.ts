/** One line of what a plot scores: a flat number of points, or a die whose sign is in the string ("-D3"). */
export type PlotScoringLine = { id: number; points: number | null; dice: string; text: string };

/** One rung of a plot's ladder: what the campaign point total unlocks (40 wins the campaign). */
export type PlotAchievement = { id: number; points: number; name: string; text: string };

/** A plot on the catalogue list (Settings → Plots offers them all, from every setting). */
export type PlotRow = {
  id: number;
  name: string;
  summary: string;
  /** Who may follow it, as prose the player decides on: never matched to warband types. */
  who_text: string;
  variant_of: string;
  no_alliance_with: string[];
  campaign_id: number | null;
  setting_id: number | null;
  in_play?: boolean | null;
};

/** A plot whole: its scoring lines and its ladder (the detail, and the campaign's own list). */
export type Plot = PlotRow & {
  scoring: PlotScoringLine[];
  achievements: PlotAchievement[];
  /** What the plot is missing, from a write: never a refusal (apps/plots/checks.py). */
  warnings?: string[];
};

/** A campaign's own plot, written whole: the lists it sends replace those lists. */
export type PlotInput = {
  name: string;
  who_text: string;
  scoring: { points: number | null; dice: string; text: string }[];
  achievements: { points: number; name: string; text: string }[];
};
