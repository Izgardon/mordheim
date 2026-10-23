import { apiRequest } from "@/lib/api-client";
import { socketIdHeaders } from "@/lib/realtime/socket-headers";

import type { CatalogueUsage } from "@/lib/catalogue-delete";
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
  "dramatis-personae": "dramatis-personae",
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

const bookQuery = (entry: Entry, campaignId: number) =>
  entry.campaign_id == null ? `?campaign_id=${campaignId}` : "";

/** `GET <kind>/:id/usage/`: what in the campaign holds the entry (before a delete). */
export function entryUsage(kind: CatalogueEntryKind, entry: Entry, campaignId: number) {
  return apiRequest<CatalogueUsage>(
    `${entryPath(kind, entry, "usage")}${bookQuery(entry, campaignId)}`
  );
}

/** A delete's answer: null when it was deleted (204), else what happened instead. */
export type DeleteOutcome = { outcome: "archived" | "removed"; usage: CatalogueUsage } | null;

/**
 * `DELETE <kind>/:id/`: a custom entry is deleted, or archived while something holds it; a book
 * entry is removed for this campaign only (CAT-TWEAK-04, CAT-NEW-05).
 */
export function deleteEntry(kind: CatalogueEntryKind, entry: Entry, campaignId: number) {
  return apiRequest<DeleteOutcome>(`${entryPath(kind, entry)}${bookQuery(entry, campaignId)}`, {
    method: "DELETE",
    headers: socketIdHeaders(),
  });
}

/**
 * `POST <kind>/:id/restore/`: an archived entry, or a book entry removed for the campaign, is back
 * in the campaign's lists (CAT-TWEAK-04, CAT-NEW-05). The answer is the entry.
 */
export function restoreEntry<T>(kind: CatalogueEntryKind, entry: Entry, campaignId: number) {
  const body = bookCampaign(entry, campaignId);
  return apiRequest<T>(entryPath(kind, entry, "restore"), {
    method: "POST",
    headers: socketIdHeaders(),
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
    headers: socketIdHeaders(),
    body: "campaign_id" in body ? body : undefined,
  });
}
