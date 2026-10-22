import { apiRequest } from "@/lib/api-client";

import type { CatalogueKind } from "@/lib/query-keys";
import type { CatalogueEntryLike } from "../types/catalogue-entry";

/** The kinds whose entries are edited, reverted, deleted and restored (not item properties). */
export type CatalogueEntryKind = Exclude<CatalogueKind, "item-properties">;

const PATHS: Record<CatalogueEntryKind, string> = {
  items: "items",
  skills: "skills",
  spells: "spells",
  specials: "special",
  races: "races",
  bestiary: "bestiary",
  "hired-swords": "hired-swords",
};

type Entry = Pick<CatalogueEntryLike, "id" | "campaign_id">;

const entryPath = (kind: CatalogueEntryKind, entry: Entry, action = "") =>
  `/${PATHS[kind]}/${entry.id}/${action ? `${action}/` : ""}`;

/**
 * What a write to a book entry adds: the campaign it is for (backend PR C). A campaign's own rows
 * and versions name their campaign themselves, so they send nothing.
 */
export function bookCampaign(entry: Entry | null | undefined, campaignId: number) {
  return entry && entry.campaign_id == null ? { campaign_id: campaignId } : {};
}

/**
 * `POST <kind>/:id/restore/`: an archived entry, or a book entry removed for the campaign, is back
 * in the campaign's lists (CAT-TWEAK-04, CAT-NEW-05). The answer is the entry.
 */
export function restoreEntry<T>(kind: CatalogueEntryKind, entry: Entry, campaignId: number) {
  const body = bookCampaign(entry, campaignId);
  return apiRequest<T>(entryPath(kind, entry, "restore"), {
    method: "POST",
    body: "campaign_id" in body ? body : undefined,
  });
}

/**
 * `POST <kind>/:id/revert/`: the campaign's version goes and its copies go back to the book entry,
 * keeping what was paid (CAT-TWEAK-01). The answer is the campaign's entry for the book entry now:
 * the book's own, or a house rule's new clone.
 */
export function revertEntry<T>(kind: CatalogueEntryKind, entry: Entry, campaignId: number) {
  const body = bookCampaign(entry, campaignId);
  return apiRequest<T>(entryPath(kind, entry, "revert"), {
    method: "POST",
    body: "campaign_id" in body ? body : undefined,
  });
}
