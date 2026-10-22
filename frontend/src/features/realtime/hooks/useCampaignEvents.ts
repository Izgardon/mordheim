import { useQueryClient } from "@tanstack/react-query";

import { writeCampaignAnswer } from "@/features/campaigns/hooks/useCampaignQuery";
import { invalidateHeldCopies } from "@/lib/catalogue-queries";
import { queryKeys, type CatalogueKind } from "@/lib/query-keys";
import { useCampaignCatalogueChanges, useCampaignUpdates } from "@/lib/realtime";

import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";

/** The server's catalogue kinds (`catalogue.changed {kind}`) as the cached lists name them. */
const CATALOGUE_KINDS: Record<string, CatalogueKind> = {
  items: "items",
  item_properties: "item-properties",
  skills: "skills",
  spells: "spells",
  specials: "specials",
  races: "races",
  bestiary: "bestiary",
  hired_swords: "hired-swords",
};

/** The cached list a `catalogue.changed` names, or null for a kind this app doesn't cache. */
export const catalogueKindOf = (serverKind: string): CatalogueKind | null =>
  CATALOGUE_KINDS[serverKind] ?? null;

/**
 * Campaign changes made by other members reach this one live (CAMP-NEW-07): `campaign.updated`
 * (a start, settings, a new join code, archive or restore) is written over the cached campaign,
 * keeping the reader's own role, permissions, capabilities and unread count. `catalogue.changed`
 * (BUG-80) marks that kind's lists stale (every variant, e.g. the Archived one): a page showing one
 * reads it again at once, and the others on their next visit. For a kind units carry, the
 * campaign's warband sheets (and stashes, for items) are marked stale too, since another member's
 * edit or Revert may have moved or changed their copies.
 */
export function useCampaignEvents(campaignId: number | null) {
  const queryClient = useQueryClient();
  useCampaignUpdates(campaignId, (payload) => {
    if (campaignId) {
      writeCampaignAnswer(queryClient, campaignId, payload as unknown as CampaignSummary);
    }
  });
  useCampaignCatalogueChanges(campaignId, ({ kind }) => {
    const catalogueKind = catalogueKindOf(kind);
    if (campaignId && catalogueKind) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.campaign.catalogue(campaignId, catalogueKind),
      });
      void invalidateHeldCopies(queryClient, catalogueKind, campaignId);
    }
  });
}
