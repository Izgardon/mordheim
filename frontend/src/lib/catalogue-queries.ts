import { useMemo } from "react";
import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";

// api
import { listBestiaryEntries } from "@/features/bestiary/api/bestiary-api";
import { listHirelingProfiles } from "@/features/hirelings/api/hireling-catalogue-api";
import { listItemProperties, listItems } from "@/features/items/api/items-api";
import { listRaces } from "@/features/races/api/races-api";
import { listSkills } from "@/features/skills/api/skills-api";
import { listSpecial } from "@/features/special/api/special-api";
import { listSpells } from "@/features/spells/api/spells-api";

// other
import { type CatalogueKind, queryKeys } from "./query-keys";

// types
import type { BestiaryEntrySummary } from "@/features/bestiary/types/bestiary-types";
import type { HirelingProfile } from "@/features/hirelings/types/hireling-catalogue-types";
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
  "hired-swords": HirelingProfile;
  "dramatis-personae": HirelingProfile;
};

export type CatalogueEntry<K extends CatalogueKind> = CatalogueEntries[K];

/**
 * A list beside a kind's default one, cached on its own under the kind's key: "archived" adds the
 * campaign's archived entries and removed book entries (`?archived=1`, CAT-TWEAK-04).
 */
export type CatalogueListVariant = "archived";

type Fetcher<K extends CatalogueKind> = (
  campaignId: number,
  signal: AbortSignal,
  variant?: CatalogueListVariant
) => Promise<CatalogueEntry<K>[]>;

/** The Archived list asks for `?archived=1`; the default list sends nothing extra. */
const archivedOf = (variant?: CatalogueListVariant) =>
  variant === "archived" ? { archived: true } : {};

const fetchers: { [K in CatalogueKind]: Fetcher<K> } = {
  items: (campaignId, signal, variant) => listItems({ campaignId, signal, ...archivedOf(variant) }),
  "item-properties": (campaignId, signal) => listItemProperties({ campaignId, signal }),
  skills: (campaignId, signal, variant) =>
    listSkills({ campaignId, signal, ...archivedOf(variant) }),
  spells: (campaignId, signal, variant) =>
    listSpells({ campaignId, signal, ...archivedOf(variant) }),
  specials: (campaignId, signal) => listSpecial({ campaignId, signal }),
  races: (campaignId, signal) => listRaces({ campaignId, signal }),
  bestiary: (campaignId, signal, variant) =>
    listBestiaryEntries({ campaignId, signal, ...archivedOf(variant) }),
  "hired-swords": (campaignId, signal, variant) =>
    listHirelingProfiles("hired-swords", { campaignId, signal, ...archivedOf(variant) }),
  "dramatis-personae": (campaignId, signal, variant) =>
    listHirelingProfiles("dramatis-personae", { campaignId, signal, ...archivedOf(variant) }),
};

/** The key of one of a kind's lists: the default one, or a variant under it. */
export const catalogueListKey = (
  campaignId: number,
  kind: CatalogueKind,
  variant?: CatalogueListVariant
) =>
  variant
    ? queryKeys.campaign.catalogueVariant(campaignId, kind, variant)
    : queryKeys.campaign.catalogue(campaignId, kind);

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
  "dramatis-personae": "Failed to load dramatis personae",
};

const NO_ENTRIES: never[] = [];

function isCampaignId(campaignId: number | null | undefined): campaignId is number {
  return typeof campaignId === "number" && Number.isFinite(campaignId) && campaignId > 0;
}

type UseCatalogueOptions = {
  enabled?: boolean;
  /** Another list of the kind than the default one. */
  variant?: CatalogueListVariant;
};

/** One campaign catalogue list, shared and cached across every component that needs it. */
export function useCatalogue<K extends CatalogueKind>(
  kind: K,
  campaignId: number | null | undefined,
  { enabled = true, variant }: UseCatalogueOptions = {}
) {
  const hasCampaign = isCampaignId(campaignId);
  const query = useQuery({
    queryKey: catalogueListKey(hasCampaign ? campaignId : 0, kind, variant),
    queryFn: ({ signal }) => (fetchers[kind] as Fetcher<K>)(campaignId as number, signal, variant),
    staleTime: CATALOGUE_STALE_TIME_MS,
    enabled: hasCampaign && enabled,
  });

  // A failed background refetch (focus or reconnect while offline) keeps the cached list on
  // screen; only a list that never loaded reports its error.
  const error =
    query.error && query.data === undefined
      ? (query.error instanceof Error && query.error.message) || errorLabels[kind]
      : "";

  return {
    data: (query.data ?? NO_ENTRIES) as CatalogueEntry<K>[],
    isLoading: query.isLoading,
    error,
    /** Reads the list again, e.g. from a Retry beside its error. */
    refetch: query.refetch,
  };
}

/** `entry` in place of the row `replacedId` names (or its own id), or first when neither is listed. */
function placed<T extends { id: number }>(rows: T[], entry: T, replacedId: number) {
  let found = false;
  const next = rows.flatMap((existing) => {
    if (existing.id !== replacedId && existing.id !== entry.id) {
      return [existing];
    }
    if (found) {
      return [];
    }
    found = true;
    return [entry];
  });
  return found ? next : [entry, ...rows];
}

/**
 * Insert or replace an entry by id in every cached list of its kind, newest first, then refetch
 * in the background. `replacedId` names the row it stands in for: a book entry's first edit
 * answers the campaign's new version, and a Revert answers the book entry, each in the other's
 * place, so the row never flickers (CAT-TWEAK-01).
 */
export function upsertCatalogueEntry<K extends CatalogueKind>(
  queryClient: QueryClient,
  kind: K,
  campaignId: number,
  entry: CatalogueEntry<K>,
  replacedId: number = entry.id
) {
  if (!isCampaignId(campaignId)) {
    return;
  }
  const queryKey = queryKeys.campaign.catalogue(campaignId, kind);
  // The kind's lists (the default one and its variants); a cached single entry isn't a list.
  queryClient.setQueriesData({ queryKey }, (previous: unknown) =>
    Array.isArray(previous) ? placed(previous as CatalogueEntry<K>[], entry, replacedId) : previous
  );
  void queryClient.invalidateQueries({ queryKey });
}

/**
 * Drop an entry from every cached list of its kind, then refetch them: a deleted entry is gone,
 * and an archived or removed one comes back in the Archived list from the server.
 */
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
  queryClient.setQueriesData({ queryKey }, (previous: unknown) =>
    Array.isArray(previous)
      ? (previous as { id: number }[]).filter((existing) => existing.id !== entryId)
      : previous
  );
  void queryClient.invalidateQueries({ queryKey });
}

/** The kinds whose copies a warband's units carry; a stash holds items only. */
const HELD_BY_UNITS = new Set<CatalogueKind>(["items", "skills", "spells", "specials", "races"]);

/**
 * After a write that changes what copies point at or show (a book entry's first edit makes a
 * version and moves the campaign's copies onto it, a Revert moves them back, an edit changes a
 * campaign entry in place), the campaign's cached warband sheets (and, for items, stashes) are
 * marked stale: the one on screen reads its units' current ids and values again, the others on
 * their next visit. Only that campaign's sheets and stashes; nothing else is read.
 */
export function invalidateHeldCopies(
  queryClient: QueryClient,
  kind: CatalogueKind,
  campaignId: number
) {
  if (!HELD_BY_UNITS.has(kind) || !isCampaignId(campaignId)) {
    return Promise.resolve();
  }
  const parts = kind === "items" ? ["sheet", "stash"] : ["sheet"];
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === "campaign" &&
      queryKey[1] === campaignId &&
      queryKey[2] === "warband" &&
      typeof queryKey[3] === "number" &&
      parts.includes(queryKey[4] as string),
  });
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

/**
 * The lists a write of a kind changes besides its own, as the server announces them (its
 * `catalogue.changed` kinds for the write): a beast's Animal item is written with the beast, so
 * a bestiary write (a save, Revert, delete or restore) changes the items list too; hired swords
 * and dramatis personae name their race, so a race write changes their lists.
 */
const WRITTEN_WITH: Partial<Record<CatalogueKind, CatalogueKind[]>> = {
  bestiary: ["items"],
  races: ["hired-swords", "dramatis-personae"],
};

/** `kind` and the kinds its writes change with it. */
const writtenKinds = (kind: CatalogueKind) => [kind, ...(WRITTEN_WITH[kind] ?? [])];

/**
 * Cache writes for components that create, edit or delete catalogue entries. Each also marks
 * stale the lists the write changed with its own kind (`WRITTEN_WITH`): the server's event for
 * them goes to the other members only.
 */
export function useCatalogueCache() {
  const queryClient = useQueryClient();
  return useMemo(() => {
    const alsoChanged = (kind: CatalogueKind, campaignId: number) =>
      (WRITTEN_WITH[kind] ?? []).forEach(
        (other) => void invalidateCatalogue(queryClient, other, campaignId)
      );
    return {
      upsert: <K extends CatalogueKind>(kind: K, campaignId: number, entry: CatalogueEntry<K>) => {
        upsertCatalogueEntry(queryClient, kind, campaignId, entry);
        alsoChanged(kind, campaignId);
      },
      /** A write's answer in place of the row it stands in for (a version for its book entry). */
      write: <K extends CatalogueKind>(
        kind: K,
        campaignId: number,
        entry: CatalogueEntry<K>,
        replacedId?: number
      ) => {
        upsertCatalogueEntry(queryClient, kind, campaignId, entry, replacedId);
        alsoChanged(kind, campaignId);
      },
      remove: (kind: CatalogueKind, campaignId: number, entryId: number) => {
        removeCatalogueEntry(queryClient, kind, campaignId, entryId);
        alsoChanged(kind, campaignId);
      },
      invalidate: (kind: CatalogueKind, campaignId: number) =>
        Promise.all(
          writtenKinds(kind).map((each) => invalidateCatalogue(queryClient, each, campaignId))
        ),
      /**
       * The campaign's warband sheets (and stashes) after copies moved or changed: a beast's
       * first edit or Revert moves the copies of its Animal item.
       */
      heldCopiesChanged: (kind: CatalogueKind, campaignId: number) =>
        Promise.all(
          writtenKinds(kind).map((each) => invalidateHeldCopies(queryClient, each, campaignId))
        ),
    };
  }, [queryClient]);
}
