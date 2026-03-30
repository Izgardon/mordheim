import { CardBackground } from "@/components/ui/card-background";

import type { CampaignTopKiller } from "../../types/campaign-types";

type OnesToWatchRowProps = {
  isLoading: boolean;
  error: string;
  topKiller: CampaignTopKiller | null;
};

function OnesToWatchSkeleton() {
  return (
    <CardBackground className="space-y-4 bg-[rgba(12,9,6,0.92)] p-4 sm:p-5">
      <div className="h-3 w-28 animate-pulse rounded bg-muted-foreground/15" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-6 w-40 animate-pulse rounded bg-muted-foreground/20" />
          <div className="h-4 w-28 animate-pulse rounded bg-muted-foreground/15" />
        </div>
        <div className="h-12 w-16 animate-pulse rounded-lg bg-muted-foreground/15" />
      </div>
    </CardBackground>
  );
}

export default function OnesToWatchRow({
  isLoading,
  error,
  topKiller,
}: OnesToWatchRowProps) {
  return (
    <section className="space-y-2">
      <p className="text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">
        Ones to watch for
      </p>
      {isLoading ? (
        <OnesToWatchSkeleton />
      ) : error ? (
        <CardBackground className="space-y-2 bg-[rgba(12,9,6,0.92)] p-4 sm:p-5">
          <p className="text-sm text-red-600">{error}</p>
        </CardBackground>
      ) : topKiller ? (
        <CardBackground className="space-y-4 bg-[rgba(12,9,6,0.92)] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-foreground sm:text-xl">
                {topKiller.unit_name}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {topKiller.warband_name}
              </p>
              {topKiller.unit_type ? (
                <p className="mt-1 text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground/80">
                  {topKiller.unit_type}
                </p>
              ) : null}
            </div>
            <div className="rounded-lg border border-border/60 bg-black/20 px-3 py-2 text-right">
              <p className="text-[0.58rem] uppercase tracking-[0.15em] text-muted-foreground">
                Kills
              </p>
              <p className="text-xl font-semibold text-foreground">{topKiller.kills}</p>
            </div>
          </div>
        </CardBackground>
      ) : (
        <CardBackground className="space-y-2 bg-[rgba(12,9,6,0.92)] p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">No kills recorded yet.</p>
        </CardBackground>
      )}
    </section>
  );
}
