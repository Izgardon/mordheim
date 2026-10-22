import type { BookSummary, CatalogueEntryLike } from "../types/catalogue-entry";

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

/** A house rule's clone: it shows "Set by …" instead of Revert, and an edit detaches it. */
export const isRuleVersion = (entry: Pick<CatalogueEntryLike, "generated_effect_key">) =>
  Boolean(entry.generated_effect_key);

/** "half_price_armour" → "Half price armour": the rule that set a clone. */
export function ruleLabel(effectKey: string) {
  const words = effectKey.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const FIELD_LABELS: Record<string, string> = {
  dc: "difficulty",
  roll: "D6",
  save: "save",
  single_use: "single use",
  armour_save: "armour save",
  hire_cost: "hire cost",
  upkeep_cost: "upkeep cost",
};

const shown = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  return text.length > 80 ? `${text.slice(0, 79)}…` : text;
};

/**
 * What the book says, for a version's tooltip: "Book: 5 gc" for an item, then up to three fields
 * the version changed with the book's value ("Book name: Axe").
 */
export function bookLines(book: BookSummary): string[] {
  const lines = book.price != null ? [`Book: ${book.price} gc`] : [];
  const changes = Object.entries(book.changes ?? {}).slice(0, 3);
  for (const [field, value] of changes) {
    const label = FIELD_LABELS[field] ?? field.replace(/_/g, " ");
    lines.push(`Book ${label}: ${shown(value)}`);
  }
  return lines;
}

/** "Changed by Pia, Oct 21, 2026" (either half may be missing), or null. */
export function changedByLine(entry: Pick<CatalogueEntryLike, "updated_by" | "updated_at">) {
  const when = entry.updated_at
    ? new Date(entry.updated_at).toLocaleDateString(undefined, { dateStyle: "medium" })
    : "";
  if (entry.updated_by && when) return `Changed by ${entry.updated_by}, ${when}`;
  if (entry.updated_by) return `Changed by ${entry.updated_by}`;
  return when ? `Changed ${when}` : null;
}
