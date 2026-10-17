import { useMemo } from "react";
import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";

// api
import { listBestiaryEntries, listHiredSwordProfiles } from "@/features/bestiary/api/bestiary-api";
import { listItemProperties, listItems } from "@/features/items/api/items-api";
import { listRaces } from "@/features/races/api/races-api";
import { listSkills } from "@/features/skills/api/skills-api";
import { listSpecial } from "@/features/special/api/special-api";
import { listSpells } from "@/features/spells/api/spells-api";

// other
import { type CatalogueKind, queryKeys } from "./query-keys";

// types
import type {
  BestiaryEntrySummary,
  HiredSwordProfileSummary,
} from "@/features/bestiary/types/bestiary-types";
import type { Item, ItemProperty } from "@/features/items/types/item-types";
import type { Race } from "@/features/races/types/race-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";

/** Catalogue lists change only on rare writes (which update the cache), so reuse them for 5 min. */
export const CATALOGUE_STALE_TIME_MS = 5 * 60_000;

type CatalogueEntries = {
  items: Item;
  "item-properties": ItemProperty;
  skills: Skill;
  spells: Spell;
  specials: Special;
  races: Race;
  bestiary: BestiaryEntrySummary;
  "hired-swords": HiredSwordProfileSummary;
};

export type CatalogueEntry<K extends CatalogueKind> = CatalogueEntries[K];

type Fetcher<K extends CatalogueKind> = (
  campaignId: number,
  signal: AbortSignal
) => Promise<CatalogueEntry<K>[]>;

const fetchers: { [K in CatalogueKind]: Fetcher<K> } = {
  items: (campaignId, signal) => listItems({ campaignId, signal }),
  "item-properties": (campaignId, signal) => listItemProperties({ campaignId, signal }),
  skills: (campaignId, signal) => listSkills({ campaignId, signal }),
  spells: (campaignId, signal) => listSpells({ campaignId, signal }),
  specials: (campaignId, signal) => listSpecial({ campaignId, signal }),
  races: (campaignId, signal) => listRaces({ campaignId, signal }),
  bestiary: (campaignId, signal) => listBestiaryEntries({ campaignId, signal }),
  "hired-swords": (campaignId, signal) => listHiredSwordProfiles({ campaignId, signal }),
};

// The wording the pages showed before the move to TanStack Query.
const errorLabels: Record<CatalogueKind, string> = {
  items: "Unable to load items",
  "item-properties": "Unable to load item properties",
  skills: "Unable to load skills",
  spells: "Unable to load spells",
  specials: "Unable to load special",
  races: "Unable to load races",
  bestiary: "Failed to load bestiary",
  "hired-swords": "Failed to load hired swords",
};

const NO_ENTRIES: never[] = [];

function isCampaignId(campaignId: number | null | undefined): campaignId is number {
  return typeof campaignId === "number" && Number.isFinite(campaignId) && campaignId > 0;
}

type UseCatalogueOptions = {
  enabled?: boolean;
};

/** One campaign catalogue list, shared and cached across every component that needs it. */
export function useCatalogue<K extends CatalogueKind>(
  kind: K,
  campaignId: number | null | undefined,
  { enabled = true }: UseCatalogueOptions = {}
) {
  const hasCampaign = isCampaignId(campaignId);
  const query = useQuery({
    queryKey: queryKeys.campaign.catalogue(hasCampaign ? campaignId : 0, kind),
    queryFn: ({ signal }) => (fetchers[kind] as Fetcher<K>)(campaignId as number, signal),
    staleTime: CATALOGUE_STALE_TIME_MS,
    enabled: hasCampaign && enabled,
  });

  const error = query.error
    ? (query.error instanceof Error && query.error.message) || errorLabels[kind]
    : "";

  return {
    data: (query.data ?? NO_ENTRIES) as CatalogueEntry<K>[],
    isLoading: query.isLoading,
    error,
  };
}

/** Insert or replace an entry by id in a cached list, newest first, then refetch in the background. */
export function upsertCatalogueEntry<K extends CatalogueKind>(
  queryClient: QueryClient,
  kind: K,
  campaignId: number,
  entry: CatalogueEntry<K>
) {
  if (!isCampaignId(campaignId)) {
    return;
  }
  const queryKey = queryKeys.campaign.catalogue(campaignId, kind);
  queryClient.setQueryData(queryKey, (previous: CatalogueEntry<K>[] | undefined) => {
    if (!previous) {
      return previous;
    }
    return previous.some((existing) => existing.id === entry.id)
      ? previous.map((existing) => (existing.id === entry.id ? entry : existing))
      : [entry, ...previous];
  });
  void queryClient.invalidateQueries({ queryKey });
}

export function removeCatalogueEntry(
  queryClient: QueryClient,
  kind: CatalogueKind,
  campaignId: number,
  entryId: number
) {
  if (!isCampaignId(campaignId)) {
    return;
  }
  const queryKey = queryKeys.campaign.catalogue(campaignId, kind);
  queryClient.setQueryData(queryKey, (previous: { id: number }[] | undefined) =>
    previous ? previous.filter((existing) => existing.id !== entryId) : previous
  );
  void queryClient.invalidateQueries({ queryKey });
}

export function invalidateCatalogue(
  queryClient: QueryClient,
  kind: CatalogueKind,
  campaignId: number
) {
  if (!isCampaignId(campaignId)) {
    return Promise.resolve();
  }
  return queryClient.invalidateQueries({
    queryKey: queryKeys.campaign.catalogue(campaignId, kind),
  });
}

/** Cache writes for components that create, edit or delete catalogue entries. */
export function useCatalogueCache() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      upsert: <K extends CatalogueKind>(kind: K, campaignId: number, entry: CatalogueEntry<K>) =>
        upsertCatalogueEntry(queryClient, kind, campaignId, entry),
      remove: (kind: CatalogueKind, campaignId: number, entryId: number) =>
        removeCatalogueEntry(queryClient, kind, campaignId, entryId),
      invalidate: (kind: CatalogueKind, campaignId: number) =>
        invalidateCatalogue(queryClient, kind, campaignId),
    }),
    [queryClient]
  );
}
