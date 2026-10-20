import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getItem } from "@/features/items/api/items-api";
import { getSkill } from "@/features/skills/api/skills-api";
import { getSpecial } from "@/features/special/api/special-api";
import { getSpell } from "@/features/spells/api/spells-api";
import { CATALOGUE_STALE_TIME_MS, type CatalogueEntry } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";

import type { DetailEntry } from "../../components/shared/unit_details/detail-types";

const kindOf = { item: "items", skill: "skills", spell: "spells", special: "specials" } as const;

type DetailKind = (typeof kindOf)[DetailEntry["type"]];
type DetailData = CatalogueEntry<DetailKind>;

const readEntry: Record<DetailEntry["type"], (id: number) => Promise<DetailData>> = {
  item: getItem,
  skill: getSkill,
  spell: getSpell,
  special: getSpecial,
};

/**
 * The catalogue entry behind a detail card (CAT-PERF-03): taken from the campaign's cached list
 * of its kind when that list holds it, so no request; otherwise read by id once and kept as long
 * as the lists are. Its key sits under the list's, so a catalogue write that refreshes the list
 * refreshes the entry too.
 */
export function useDetailEntry(entry: DetailEntry, campaignId: number) {
  const queryClient = useQueryClient();
  const scope = Number.isFinite(campaignId) && campaignId > 0 ? campaignId : 0;
  const listKey = queryKeys.campaign.catalogue(scope, kindOf[entry.type]);
  return useQuery({
    queryKey: [...listKey, entry.id],
    queryFn: () => readEntry[entry.type](entry.id),
    initialData: () =>
      queryClient.getQueryData<DetailData[]>(listKey)?.find((cached) => cached.id === entry.id),
    initialDataUpdatedAt: () => queryClient.getQueryState(listKey)?.dataUpdatedAt,
    staleTime: CATALOGUE_STALE_TIME_MS,
  });
}
