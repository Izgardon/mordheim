import type { CampaignChart, CampaignChartRow, RuleTable } from "@/features/rules/types/rule-types";

/** A number of heroes, or "all": every hero the warband has on its roster. */
export type HeroCount = number | "all";

/** A campaign table a location points to: its chip opens the table from the campaign's list. */
export type LocationChartLink = { id: number; title: string };

/**
 * One place a warband sends heroes to (William, 23 Nov 2026): its rules as text, how many heroes
 * go, whether going spends each one's trading action, its own tables (shown only inside it) and the
 * campaign tables it points to. `heroes_text` is the server's: "1 hero", "1 to all heroes".
 */
export type CampaignLocation = {
  id: number;
  group_id: number;
  name: string;
  rules: string;
  min_heroes: HeroCount;
  max_heroes: HeroCount;
  heroes_text: string;
  takes_trading_action: boolean;
  order: number;
  tables: CampaignChart[];
  charts: LocationChartLink[];
};

/** A group of locations (the Marketplace, The Undercity): restrictions are text nothing checks. */
export type LocationGroup = {
  id: number;
  campaign_id: number;
  name: string;
  description: string;
  restrictions: string;
  order: number;
  locations: CampaignLocation[];
};

export type LocationGroupPayload = Pick<LocationGroup, "name" | "description" | "restrictions">;

/** A location's own table as it is written: a chart's fields, each result with its own table. */
export type LocationTablePayload = {
  title: string;
  description: string;
  dice: string;
  note: string;
  rows: (CampaignChartRow & { chart?: RuleTable | null })[];
};

/** A location written whole: `tables` and `chart_ids` replace what it held. */
export type LocationPayload = {
  group_id: number;
  name: string;
  rules: string;
  min_heroes: HeroCount;
  max_heroes: HeroCount;
  takes_trading_action: boolean;
  tables: LocationTablePayload[];
  chart_ids: number[];
};

export type VisitWarning = { code: string; message: string; hero_id?: number };

/** What a visit answers: the heroes' trading actions as they now stand, the line, the warnings. */
export type VisitAnswer = {
  heroes: { id: number; trading_action: boolean }[];
  message: string;
  warnings: VisitWarning[];
};
