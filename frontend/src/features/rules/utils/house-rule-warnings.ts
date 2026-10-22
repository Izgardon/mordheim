import { toast } from "sonner";

import type { HouseRule, HouseRuleAnswer } from "../types/rule-types";

/**
 * A rule write's warnings (backend PR C): `house_rule_skipped` names the book items the campaign
 * has its own version of, which the rule left alone. Each shows as a toast (the write went ahead),
 * and the rule is cached without them.
 */
export function takeHouseRuleWarnings({ warnings = [], ...rule }: HouseRuleAnswer): HouseRule {
  for (const warning of warnings) {
    toast.warning(warning.message, { id: `house-rule-${rule.id}-${warning.code}` });
  }
  return rule;
}
