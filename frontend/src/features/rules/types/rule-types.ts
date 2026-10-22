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

export type HouseRulePayload = {
  title: string;
  description: string;
  effect_key?: string | null;
};
