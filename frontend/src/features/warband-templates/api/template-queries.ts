import { useQuery } from "@tanstack/react-query";

import { CATALOGUE_STALE_TIME_MS } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";

import { getWarbandTemplate, listWarbandTemplates } from "./templates-api";
import type { WarbandTemplateSummary } from "../types/template-types";

const NONE: WarbandTemplateSummary[] = [];

/** The campaign's warband templates (Reference → Warbands), reused like the catalogue lists. */
export function useWarbandTemplates(campaignId: number) {
  const query = useQuery({
    queryKey: queryKeys.campaign.warbandTemplates(campaignId),
    queryFn: ({ signal }) => listWarbandTemplates(campaignId, signal),
    enabled: campaignId > 0,
    staleTime: CATALOGUE_STALE_TIME_MS,
  });
  return {
    data: query.data ?? NONE,
    isLoading: query.isLoading,
    error: query.error && !query.data ? "Unable to load the warbands" : "",
  };
}

/**
 * The campaign's templates with what each holds by name (`?view=search`): Search everything finds
 * a warband type by its fighters, rules and skills.
 */
export function useWarbandTemplateContents(campaignId: number) {
  const query = useQuery({
    queryKey: queryKeys.campaign.warbandTemplateContents(campaignId),
    queryFn: ({ signal }) => listWarbandTemplates(campaignId, signal, "search"),
    enabled: campaignId > 0,
    staleTime: CATALOGUE_STALE_TIME_MS,
  });
  return { data: query.data ?? NONE, isLoading: query.isLoading };
}

/** One whole template, read when its row opens. */
export function useWarbandTemplate(campaignId: number, templateId: number) {
  return useQuery({
    queryKey: queryKeys.campaign.warbandTemplate(campaignId, templateId),
    queryFn: ({ signal }) => getWarbandTemplate(templateId, signal),
    staleTime: CATALOGUE_STALE_TIME_MS,
  });
}
