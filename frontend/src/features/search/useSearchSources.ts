import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useCampaignLocations } from "@/features/campaigns/api/campaign-queries";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { inPlayOnly } from "@/features/reference/in-play";
import { referenceSpecials } from "@/features/special/boons-banes";
import { useCampaignRules, useHouseRules } from "@/features/rules/api/rule-queries";
import { ruleEntries } from "@/features/rules/rules-index";
import { useWarbandTemplateContents } from "@/features/warband-templates/api/template-queries";
import { typeRows } from "@/features/warband-templates/template-view";
import { myWarbandQuery } from "@/features/warbands/api/warband-queries";
import { useWarbandTypes } from "@/features/warbands/api/warband-types-queries";
import { useCatalogue } from "@/lib/catalogue-queries";

import { useCampaignSearch } from "./api/search-api";
import type { SearchSources } from "./search-everything";

/**
 * What Search everything searches: the lists the pages already load, each as its page lists it
 * (the reference only what is in play in the campaign; the warband types as the Warbands page's
 * rows, with what their templates hold), the locations while they are on, and the server's
 * search of the campaign's warbands and units for the `settled` text.
 */
export function useSearchSources(
  campaignId: number,
  campaign: CampaignSummary | null,
  settled: string
) {
  const templates = useWarbandTemplateContents(campaignId);
  const types = useWarbandTypes(campaignId);
  const items = useCatalogue("items", campaignId);
  const itemRules = useCatalogue("item-rules", campaignId);
  const skills = useCatalogue("skills", campaignId);
  const skillGroups = useCatalogue("skill-groups", campaignId);
  const spells = useCatalogue("spells", campaignId);
  const specials = useCatalogue("specials", campaignId);
  const beasts = useCatalogue("bestiary", campaignId);
  const hiredSwords = useCatalogue("hired-swords", campaignId);
  const personae = useCatalogue("dramatis-personae", campaignId);
  const houseRules = useHouseRules(campaignId);
  const campaignRules = useCampaignRules(campaignId);
  const withLocations = Boolean(campaign?.enable_locations);
  const locations = useCampaignLocations(campaignId, { enabled: withLocations });
  const mine = useQuery(myWarbandQuery(campaignId));
  const server = useCampaignSearch(campaignId, settled);

  const sources = useMemo<SearchSources>(
    () => ({
      warbandTypes: typeRows(templates.data, types.data),
      items: inPlayOnly(items.data),
      itemRules: itemRules.data,
      skills: inPlayOnly(skills.data),
      skillGroups: skillGroups.data,
      spells: inPlayOnly(spells.data),
      specials: referenceSpecials(specials.data),
      beasts: inPlayOnly(beasts.data),
      hiredSwords: inPlayOnly(hiredSwords.data),
      personae: inPlayOnly(personae.data),
      rules: ruleEntries(),
      houseRules: houseRules.data ?? [],
      campaignRules: campaignRules.data ?? [],
      locations: withLocations ? (locations.data ?? []) : [],
      campaign: server.data,
      myWarbandId: mine.data?.id ?? null,
    }),
    [
      beasts.data,
      campaignRules.data,
      hiredSwords.data,
      houseRules.data,
      itemRules.data,
      items.data,
      locations.data,
      mine.data?.id,
      personae.data,
      server.data,
      skillGroups.data,
      skills.data,
      specials.data,
      spells.data,
      templates.data,
      types.data,
      withLocations,
    ]
  );
  const loading =
    templates.isLoading ||
    items.isLoading ||
    skills.isLoading ||
    spells.isLoading ||
    server.isFetching;
  return { sources, loading, server };
}
