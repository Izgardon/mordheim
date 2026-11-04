import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { RaiseOutline, WarbandTemplateAnswer } from "../types/hire-template-types";

export function getWarbandTemplate(warbandId: number) {
  return apiRequest<WarbandTemplateAnswer>(`/warbands/${warbandId}/template/`);
}

export function getRaiseOutline(campaignId: number, warbandTypeId: number, variant: string) {
  const query = variant ? `?variant=${encodeURIComponent(variant)}` : "";
  return apiRequest<RaiseOutline>(
    `/campaigns/${campaignId}/warband-types/${warbandTypeId}/template/${query}`
  );
}

/**
 * The warband's template as the hire screens read it, with its variant applied and what the
 * warband has of each fighter; `enabled` waits for a form that needs it (Add hero, the rules
 * modal). A write to the warband marks it stale (it sits under the warband's keys).
 */
export function useWarbandHireTemplate(campaignId: number, warbandId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.campaign.warbandHireTemplate(campaignId, warbandId),
    queryFn: () => getWarbandTemplate(warbandId),
    enabled: enabled && warbandId > 0,
  });
}

/** A warband type's template in outline, for the raise screen (the variant asked for a type that presets none). */
export function useRaiseOutline(campaignId: number, warbandTypeId: number | null, variant: string) {
  return useQuery({
    queryKey: queryKeys.campaign.raiseOutline(campaignId, warbandTypeId ?? 0, variant),
    queryFn: () => getRaiseOutline(campaignId, warbandTypeId as number, variant),
    enabled: warbandTypeId !== null && campaignId > 0,
    // another variant of the same type keeps the outline on screen while it reads
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === (warbandTypeId ?? 0) ? previous : undefined,
  });
}
