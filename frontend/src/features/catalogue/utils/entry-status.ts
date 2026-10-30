import type { CatalogueEntryLike } from "../types/catalogue-entry";

/**
 * Where an entry comes from (backend PR C's contract): the book; the campaign's own ("custom": a
 * campaign row replacing nothing); or the campaign's version of a book entry ("version": a
 * hand-made edit, or a house rule's clone).
 */
export type EntrySource = "book" | "custom" | "version";

type SourceFields = Pick<CatalogueEntryLike, "campaign_id" | "replaces" | "generated_effect_key">;

export function entrySource(entry: SourceFields): EntrySource {
  if (entry.replaces != null || entry.generated_effect_key) {
    return "version";
  }
  return entry.campaign_id != null ? "custom" : "book";
}

/** "half_price_armour" → "Half price armour": the rule that set a clone. */
export function ruleLabel(effectKey: string) {
  const words = effectKey.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
