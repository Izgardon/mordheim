import type { HouseRule } from "../types/rule-types";

/**
 * The house rules after the server answered `applied` (BUG-52): new rules first, and a rule it
 * already had (it answers a repeated effect with the existing rule) replaced where it is.
 */
export function mergeAppliedRules(rules: HouseRule[], applied: HouseRule[]) {
  const appliedById = new Map(applied.map((rule) => [rule.id, rule]));
  const known = new Set(rules.map((rule) => rule.id));
  return [
    ...applied.filter((rule) => !known.has(rule.id)),
    ...rules.map((rule) => appliedById.get(rule.id) ?? rule),
  ];
}
