/**
 * What every catalogue list row and detail carries besides its own fields (backend PR C,
 * CAT-NEW-03): which book entry a campaign version stands in for, whether it is archived, who
 * last changed it through the catalogue and when, and the book's values a version changed.
 */
export type BookSummary = {
  /** The book entry's id (a hired sword's: the book profile's). */
  id: number;
  name: string;
  /** The book's value of each field the version changed, by payload key. */
  changes: Record<string, unknown>;
  /** Items only: the book's lowest cost ("Book: 5 gc"). */
  price?: number | null;
};

export type CatalogueBadgeFields = {
  /** The book entry a campaign version replaces (null for the book and custom entries). */
  replaces?: number | null;
  /** When it was archived, or (a book row in an Archived list) removed from the campaign. */
  archived_at?: string | null;
  /** Who last created or edited it through the catalogue (a display name). */
  updated_by?: string | null;
  updated_at?: string | null;
  /** A version's book values, for the badge's tooltip. */
  book?: BookSummary | null;
};

/** The fields the badges, Edit, Revert and Delete read from any catalogue entry. */
export type CatalogueEntryLike = CatalogueBadgeFields & {
  id: number;
  name: string;
  campaign_id?: number | null;
  /** Items: a house rule's clone (it changes with its rule). */
  generated_effect_key?: string | null;
};
