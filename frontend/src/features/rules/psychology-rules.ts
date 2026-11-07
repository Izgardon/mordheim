/**
 * The Rules page's part on a psychology special (William, 7 Nov 2026: Fear should "just say it
 * causes fear and point to the Fear rule ... That would be ideal"): its title and its row's id in
 * the rulebook (`rules-index.ts`, `rules?open=`). Immune to Psychology and Immune to Fear have no
 * part of their own.
 */
const PSYCHOLOGY_RULES: { pattern: RegExp; title: string; id: string }[] = [
  { pattern: /^(causes? )?fear(some)?\b/i, title: "Fear", id: "leadership-psychology-fear" },
  { pattern: /^frenz(y|ied)\b/i, title: "Frenzy", id: "leadership-psychology-frenzy" },
  { pattern: /^(hatred|hates?)\b/i, title: "Hatred", id: "leadership-psychology-hatred" },
  {
    pattern: /^(stupid(ity)?|moronic)\b/i,
    title: "Stupidity",
    id: "leadership-psychology-stupidity",
  },
];

export type PsychologyRule = { title: string; id: string };

/** The rule a special of this name is ("Hate Orcs and Goblins": Hatred), or null for none. */
export function psychologyRule(specialName: string): PsychologyRule | null {
  const name = specialName.trim();
  const found = PSYCHOLOGY_RULES.find((rule) => rule.pattern.test(name));
  return found ? { title: found.title, id: found.id } : null;
}

/** The Rules page opened on that part, under the campaign. */
export const psychologyRulePath = (campaignId: number | string, rule: PsychologyRule) =>
  `/campaigns/${campaignId}/rules?open=${rule.id}`;
