/** One line of the income table: the shards for a dice total up to `max_total` (null: any higher). */
export type ExplorationIncomeBand = { max_total: number | null; amount: number };

/** One place on the chart, with what finding it does, as rules text the player reads. */
export type ExplorationPlace = {
  id: number;
  face: number;
  name: string;
  /** What the place does, in the chart's own words; blank when nobody has written it yet. */
  rules: string;
};

/** The places for one multiple: doubles, triples, four of a kind and so on. */
export type ExplorationMultiple = { count: number; label: string; places: ExplorationPlace[] };

/**
 * The chart a campaign explores by (`GET campaigns/:id/exploration/`): the dice rule, the income
 * table and the places with their rules text. A chart whose `income` is empty pays no shards at
 * all and says what the dice total gives in `income_note` (Albion's supply sources).
 */
export type ExplorationChart = {
  id: number | null;
  name: string;
  summary: string;
  setting_id: number | null;
  in_play: boolean | null;
  dice: { per_hero: number; for_win: number; max: number; max_chosen: number };
  income: ExplorationIncomeBand[];
  income_note: string;
  multiples: ExplorationMultiple[];
};

/** A chart on the catalogue list, for Settings → Exploration's picker. */
export type ExplorationChartRow = {
  id: number;
  name: string;
  summary: string;
  campaign_id: number | null;
  campaign_type_id: number | null;
  in_play?: boolean | null;
};
