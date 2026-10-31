import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api-client";

export type CampaignSearchWarband = {
  id: number;
  name: string;
  type_name: string;
  user_id: number;
};

export type CampaignSearchUnit = {
  kind: "hero" | "henchmen_group" | "hireling";
  id: number;
  name: string;
  unit_type: string;
  warband_id: number;
  warband_name: string;
};

export type CampaignSearchAnswer = {
  warbands: CampaignSearchWarband[];
  units: CampaignSearchUnit[];
};

/** The shortest search the server answers (one letter finds everything). */
export const MIN_SEARCH = 2;

/**
 * `GET campaigns/<id>/search/?q=`: this campaign's warbands and the units on their
 * rosters whose names match, up to 20 of each kind.
 */
export function searchCampaign(campaignId: number, query: string, signal?: AbortSignal) {
  return apiRequest<CampaignSearchAnswer>(
    `/campaigns/${campaignId}/search/?q=${encodeURIComponent(query)}`,
    { signal }
  );
}

/** The campaign half of Search everything, kept briefly per search and shown while the next loads. */
export function useCampaignSearch(campaignId: number, query: string) {
  const text = query.trim();
  return useQuery({
    queryKey: ["campaign", campaignId, "search", text.toLowerCase()] as const,
    queryFn: ({ signal }) => searchCampaign(campaignId, text, signal),
    enabled: campaignId > 0 && text.length >= MIN_SEARCH,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
