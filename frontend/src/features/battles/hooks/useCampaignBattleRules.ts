import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { keepInjuryTexts } from "@/features/battles/components/postbattle/postbattle-rules";
import type { BattlePostbattleRules } from "@/features/battles/types/battle-types";
import { queryKeys } from "@/lib/query-keys";

/**
 * The postbattle rules, kept per campaign (item 8): they change only with the campaign's hero
 * death roll, and the end-of-fight broadcast leaves them out when the message is too big. Whatever
 * battle state or answer carried them last is remembered; nothing is read for them. A broadcast's
 * come without the injury tables' book lines, which those remembered keep.
 */
export function useCampaignBattleRules(
  campaignId: number,
  rules: BattlePostbattleRules | undefined
) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => queryKeys.campaign.battleRules(campaignId), [campaignId]);
  useEffect(() => {
    if (rules) {
      queryClient.setQueryData(queryKey, (previous: BattlePostbattleRules | undefined) =>
        keepInjuryTexts(rules, previous)
      );
    }
  }, [queryClient, queryKey, rules]);
  const cached = useQuery<BattlePostbattleRules>({
    queryKey,
    queryFn: () => Promise.reject(new Error("The rules arrive with a battle's state.")),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return useMemo(
    () => (rules ? keepInjuryTexts(rules, cached.data) : cached.data),
    [rules, cached.data]
  );
}
