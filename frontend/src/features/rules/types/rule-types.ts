export type HouseRule = {
  id: number;
  campaign_id: number;
  title: string;
  description: string;
  effect_key: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * A rule write's warning: `house_rule_skipped` names the items the campaign has its own version
 * of, which the rule left alone (backend PR C).
 */
export type HouseRuleWarning = {
  code: string;
  message: string;
  items?: { id: number; name: string; replaces: number | null }[];
};

/** A rule as a create or edit answers it: the rule and its warnings ([] when none). */
export type HouseRuleAnswer = HouseRule & { warnings?: HouseRuleWarning[] };

/** A common house rule as `rules/common/` lists it; `effect_key` is null for text only. */
export type CommonRule = {
  id: string;
  title: string;
  description: string;
  effect_key: string | null;
};

/** One result on a chart: what was rolled, its short name (may be blank) and what it does. */
export type CampaignChartRow = {
  id?: number;
  result: string;
  name: string;
  text: string;
};

/** What a rule is about: the campaign between games, or a game being set up and played. */
export type CampaignRuleKind = "campaign" | "battle";

/**
 * One of the campaign's own rules, not a house rule (William, 7 Nov 2026: "more flavourful rulings
 * on how the campaign works"): its title, body and place in the list. Its owner and admins write
 * them (`manage_campaign_rules`).
 *
 * `umbrella` is the heading clearly related rules share (William, 19 Nov 2026: "one modal for all
 * shared rules"); blank means the rule stands alone.
 */
export type CampaignRule = {
  id: number;
  campaign_id: number;
  kind: CampaignRuleKind;
  title: string;
  body: string;
  umbrella: string;
  order: number;
  /** The rule's own table, where it has one; null otherwise (William, 20 Nov 2026). */
  chart: RuleTable | null;
};

/**
 * A table belonging to one rule rather than standing on its own: it shows inside the rule and is
 * left out of the Charts list, which is for the reference charts a player looks up.
 */
export type RuleTable = {
  dice: string;
  description: string;
  note: string;
  rows: CampaignChartRow[];
};

export type CampaignRulePayload = {
  title: string;
  body: string;
  kind?: CampaignRuleKind;
  umbrella?: string;
  /** Sent to write the rule's table; null takes away the one it had. Left out leaves it alone. */
  chart?: RuleTable | null;
};

/**
 * One of the campaign's charts (William, 19 Nov 2026): a dice table a player looks up. `note`
 * carries what is true of the whole chart rather than one result, and `dice` is blank for a table
 * with no dice of its own.
 */
export type CampaignChart = {
  id: number;
  campaign_id: number;
  title: string;
  description: string;
  dice: string;
  note: string;
  umbrella: string;
  order: number;
  rows: CampaignChartRow[];
};

export type CampaignChartPayload = {
  title: string;
  description: string;
  dice: string;
  note: string;
  umbrella?: string;
  rows: CampaignChartRow[];
};

/** The dice a chart may be rolled on, as the server spells them; "" is a table with no dice. */
export const CHART_DICE = ["D3", "D6", "2D6", "3D6", "D66", "D100"] as const;

export type HouseRulePayload = {
  title: string;
  description: string;
  effect_key?: string | null;
};
