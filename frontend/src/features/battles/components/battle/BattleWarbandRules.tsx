import { useQueries } from "@tanstack/react-query";

import WarbandRules from "@/features/warbands/components/rules/WarbandRules";
import { listWarbandRules } from "@/features/warbands/api/warbands-rules";
import { queryKeys } from "@/lib/query-keys";

/**
 * The battle Rules sheet's Warband rules (the templates plan, "Warband rules"): each warband in the
 * battle with its rules as pills, which open the warband sheet's rules modal, to read. Each
 * warband's rules are read when the section opens.
 */
export default function BattleWarbandRules({
  campaignId,
  warbands,
}: {
  campaignId: number;
  warbands: { id: number; name: string }[];
}) {
  const rules = useQueries({
    queries: warbands.map((warband) => ({
      queryKey: queryKeys.campaign.warbandRules(campaignId, warband.id),
      queryFn: () => listWarbandRules(warband.id),
    })),
  });
  const shown = warbands.filter((_, index) => rules[index].data?.length);
  if (rules.some((query) => query.isPending)) {
    return <p className="m-0 text-sm text-muted-foreground">Reading the warbands&apos; rules…</p>;
  }
  if (!shown.length) return <p className="m-0 text-sm text-text2">No warband rules.</p>;
  return (
    <div className="flex flex-col gap-3">
      {warbands.map((warband, index) =>
        rules[index].data?.length ? (
          <div key={warband.id} className="flex flex-col gap-1 border-t border-line pt-2.5">
            <span className="text-sm font-bold text-head">{warband.name}</span>
            <WarbandRules
              warbandName={warband.name}
              rules={rules[index].data ?? []}
              canEdit={false}
            />
          </div>
        ) : null
      )}
    </div>
  );
}
