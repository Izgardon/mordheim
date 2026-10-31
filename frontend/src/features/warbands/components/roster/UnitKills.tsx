import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import { unitApi } from "../../units/unit-api";
import { killLine, unitKey, type RosterUnit } from "./unit-view";

/**
 * An open card's Kills (next step 9): the unit's kill counter, then each kill it scored in the
 * campaign's ended battles, newest first ("Magister Halvard · Street Fight · round 2 · melee"); a
 * henchmen group's are its members', each naming the model. Read when the card opens.
 */
export default function UnitKills({
  campaignId,
  warbandId,
  entry,
}: {
  campaignId: number;
  warbandId: number;
  entry: RosterUnit;
}) {
  const history = useQuery({
    queryKey: queryKeys.campaign.unitKills(campaignId, warbandId, unitKey(entry)),
    queryFn: () => unitApi(entry.kind).killHistory(warbandId, entry.unit.id),
    staleTime: 30_000,
  });
  const kills = history.data?.kills ?? [];
  const total = history.data?.total_kills;
  return (
    <section aria-label="Kills" className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
        Kills{total ? ` · ${total}` : ""}
      </span>
      {history.isPending ? (
        <span className="text-[13px] text-muted-foreground">Reading the kills…</span>
      ) : history.isError ? (
        <span className="text-[13px] text-danger">Couldn't read the kills.</span>
      ) : kills.length === 0 ? (
        <span className="text-[13px] text-text2">None yet</span>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {kills.map((kill) => (
            <li
              key={kill.id}
              className="border-t border-line py-1.5 text-[13px] text-ink first:border-t-0 first:pt-0"
            >
              {killLine(kill)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
