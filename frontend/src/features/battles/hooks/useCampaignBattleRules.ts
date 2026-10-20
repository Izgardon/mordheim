import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { BattlePostbattleRules } from "@/features/battles/types/battle-types";
import { queryKeys } from "@/lib/query-keys";

/**
 * The postbattle rules, kept per campaign (item 8): they change only with the campaign's hero
 * death roll, and the end-of-fight broadcast leaves them out when the message is too big. Whatever
 * battle state or answer carried them last is remembered; nothing is read for them.
 */
export function useCampaignBattleRules(
  campaignId: number,
  rules: BattlePostbattleRules | undefined
) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.campaign.battleRules(campaignId), [campaignId]);
  useEffect(() => {
    if (rules) {
      queryClient.setQueryData(queryKey, rules);
    }
  }, [queryClient, queryKey, rules]);
  const cached = useQuery<BattlePostbattleRules>({
    queryKey,
    queryFn: () => Promise.reject(new Error("The rules arrive with a battle's state.")),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return rules ?? cached.data;
}
