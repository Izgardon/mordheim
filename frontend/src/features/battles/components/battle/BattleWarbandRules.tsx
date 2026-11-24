import { useQueries } from "@tanstack/react-query";

import { ReferenceList, ReferenceRow } from "@/features/reference/ReferenceList";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import WarbandRuleArticle from "@/features/warbands/components/rules/WarbandRuleArticle";
import { listWarbandRules } from "@/features/warbands/api/warbands-rules";
import { queryKeys } from "@/lib/query-keys";

import type { OpenRow } from "./BattleRulesLists";

/**
 * The battle Rules sheet's Warband rules: a row per warband in the battle, as its rules modal
 * groups them, opening in place to every rule of it one after another (William, 24 Nov 2026: "a
 * dropdown expand system just as they are displayed on their rules pages"). Nothing stacks on
 * the sheet (William, 12 Nov 2026). A warband with no rules is left out; each warband's rules are
 * read when the section opens.
 */
export default function BattleWarbandRules({
  campaignId,
  warbands,
  openKey,
  onToggle,
}: OpenRow & { campaignId: number; warbands: { id: number; name: string }[] }) {
  const rules = useQueries({
    queries: warbands.map((warband) => ({
      queryKey: queryKeys.campaign.warbandRules(campaignId, warband.id),
      queryFn: () => listWarbandRules(warband.id),
    })),
  });
  const pending = rules.some((query) => query.isPending);
  const shown = warbands
    .map((warband, index) => ({ warband, own: rules[index].data ?? [] }))
    .filter((entry) => entry.own.length > 0);
  return (
    <ReferenceList isEmpty={!pending && shown.length === 0} empty="No warband rules.">
      {pending ? <ReferenceRowBones rows={warbands.length || 1} /> : null}
      {pending
        ? null
        : shown.map(({ warband, own }) => {
            const key = `w${warband.id}`;
            return (
              <ReferenceRow
                key={key}
                id={key}
                open={openKey === key}
                onToggle={() => onToggle(key)}
                name={warband.name}
                sub={`${own.length} ${own.length === 1 ? "rule" : "rules"}`}
              >
                <div className="flex flex-col">
                  {own.map((rule) => (
                    <WarbandRuleArticle key={rule.id} rule={rule} />
                  ))}
                </div>
              </ReferenceRow>
            );
          })}
    </ReferenceList>
  );
}
