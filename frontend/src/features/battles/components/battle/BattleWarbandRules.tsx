import { useState } from "react";
import { useQueries } from "@tanstack/react-query";

import { Chip } from "@/components/ui/chip";
import { listWarbandRules } from "@/features/warbands/api/warbands-rules";
import { queryKeys } from "@/lib/query-keys";

/**
 * The battle Rules sheet's Warband rules (the templates plan, "Warband rules"): each warband in the
 * battle with its rules as pills, and the one picked opens its text right here in the sheet
 * (William, 12 Nov 2026, on the sheet's rule opening a modal on top of it). Nothing stacks: the
 * sheet's own close is the only way out, one gesture on a phone. Each warband's rules are read when
 * the section opens.
 */
export default function BattleWarbandRules({
  campaignId,
  warbands,
}: {
  campaignId: number;
  warbands: { id: number; name: string }[];
}) {
  const [openId, setOpenId] = useState<number | null>(null);
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
      {warbands.map((warband, index) => {
        const own = rules[index].data ?? [];
        if (!own.length) return null;
        const open = own.find((rule) => rule.id === openId);
        return (
          <div key={warband.id} className="flex flex-col gap-2 border-t border-line pt-2.5">
            <span className="text-sm font-bold text-head">{warband.name}</span>
            <div className="flex flex-wrap gap-1.5">
              {own.map((rule) => (
                <Chip
                  key={rule.id}
                  pressed={rule.id === openId}
                  aria-expanded={rule.id === openId}
                  onClick={() => setOpenId(rule.id === openId ? null : rule.id)}
                >
                  {rule.title}
                </Chip>
              ))}
            </div>
            {open ? (
              <article aria-label={open.title} className="flex flex-col gap-1">
                <h3 className="m-0 text-sm font-bold text-head">{open.title}</h3>
                <p className="m-0 whitespace-pre-line text-sm text-text2">{open.description}</p>
              </article>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
