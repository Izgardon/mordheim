import { ruleSnippet } from "@/features/rules/rules-index";

export type SearchSnippet = { before: string; match: string; after: string };

/** One result: what it is, a line about it, and the page (with its row open) it links to. */
export type SearchHit = {
  key: string;
  title: string;
  meta: string;
  snippet?: SearchSnippet | null;
  /** Below `/campaigns/:id/`. */
  to: string;
};

export type SearchGroup = { id: string; label: string; hits: SearchHit[] };

/**
 * How well a name matches (lower is better): it starts with the search, a word in it does, it
 * holds it anywhere; or null.
 */
export function nameScore(name: string, needle: string) {
  const text = name.toLowerCase();
  if (text.startsWith(needle)) return 0;
  if (text.includes(` ${needle}`) || text.includes(`(${needle}`)) return 1;
  if (text.includes(needle)) return 2;
  return null;
}

type Candidate<T> = { entry: T; name: string; text?: string | null };

/**
 * The entries whose name (best) or text matches, best first then by name, each with the words
 * around a match found only in its text.
 */
export function ranked<T>(candidates: Candidate<T>[], needle: string) {
  return candidates
    .map((candidate) => {
      const byName = nameScore(candidate.name, needle);
      if (byName !== null) return { ...candidate, score: byName, snippet: null };
      const snippet = candidate.text ? ruleSnippet(candidate.text, needle, 50) : null;
      return snippet ? { ...candidate, score: 3, snippet } : null;
    })
    .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
}

export const words = (text?: string | null) => (text ?? "").replace(/\s+/g, " ").trim();
