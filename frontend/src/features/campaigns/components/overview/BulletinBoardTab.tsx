import { useMemo, useState, type FormEvent } from "react";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardBackground } from "@/components/ui/card-background";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

import type { CampaignBulletinEntry, CampaignTopKiller } from "../../types/campaign-types";

type BulletinBoardTabProps = {
  isTopKillersLoading: boolean;
  topKillersError: string;
  topKillers: CampaignTopKiller[];
  isBulletinLoading: boolean;
  bulletinError: string;
  bulletinActionError: string;
  bulletinEntries: CampaignBulletinEntry[];
  isCreatingBulletinEntry: boolean;
  deletingBulletinEntryIds: number[];
  onCreateBulletinEntry: (body: string) => Promise<unknown>;
  onDeleteBulletinEntry: (entryId: number) => Promise<unknown>;
};

function formatBulletinDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function PosterSkeleton() {
  return (
    <CardBackground className="campaign-bulletin-poster space-y-5 p-5 sm:p-6">
      <div className="h-4 w-24 animate-pulse rounded bg-[#5d4931]/20" />
      <div className="space-y-3 text-center">
        <div className="mx-auto h-10 w-3/4 animate-pulse rounded bg-[#5d4931]/20" />
        <div className="mx-auto h-4 w-1/2 animate-pulse rounded bg-[#5d4931]/15" />
      </div>
      <div className="mx-auto h-12 w-2/3 animate-pulse rounded bg-[#5d4931]/15" />
    </CardBackground>
  );
}

function BoardSkeleton() {
  return (
    <CardBackground className="campaign-bulletin-board space-y-4 p-5 sm:p-6">
      <div className="h-5 w-36 animate-pulse rounded bg-[#d6c29f]/10" />
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-xl bg-black/20" />
        <div className="h-20 animate-pulse rounded-xl bg-black/15" />
        <div className="h-20 animate-pulse rounded-xl bg-black/15" />
      </div>
    </CardBackground>
  );
}

function LeaderboardSkeleton() {
  return (
    <CardBackground className="campaign-bulletin-shell space-y-4 p-5 sm:p-6">
      <div className="h-5 w-32 animate-pulse rounded bg-[#d6c29f]/10" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-black/15" />
        ))}
      </div>
    </CardBackground>
  );
}

export default function BulletinBoardTab({
  isTopKillersLoading,
  topKillersError,
  topKillers,
  isBulletinLoading,
  bulletinError,
  bulletinActionError,
  bulletinEntries,
  isCreatingBulletinEntry,
  deletingBulletinEntryIds,
  onCreateBulletinEntry,
  onDeleteBulletinEntry,
}: BulletinBoardTabProps) {
  const [draft, setDraft] = useState("");
  const { user } = useAppStore();

  const topKiller = topKillers[0] ?? null;
  const remainingCharacters = 280 - draft.length;
  const boardErrorMessage = bulletinError || bulletinActionError;
  const sortedDangerousUnits = useMemo(() => topKillers.slice(0, 5), [topKillers]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isCreatingBulletinEntry) {
      return;
    }

    try {
      await onCreateBulletinEntry(trimmed);
      setDraft("");
    } catch {
      // Error state is managed by the parent hook.
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <div className="space-y-5">
        <section aria-label="Wanted poster">
          {isTopKillersLoading ? (
            <PosterSkeleton />
          ) : topKillersError ? (
            <CardBackground className="campaign-bulletin-poster p-5 sm:p-6">
              <p className="text-sm text-red-700">{topKillersError}</p>
            </CardBackground>
          ) : topKiller ? (
            <CardBackground className="campaign-bulletin-poster p-5 sm:p-6">
              <div className="space-y-5">
                <p className="text-center text-[0.7rem] font-semibold uppercase tracking-[0.38em] text-[#6b5130]">
                  Wanted
                </p>
                <div className="space-y-4 text-center">
                  <p className="font-serif text-[2rem] font-semibold uppercase tracking-[0.08em] text-[#24160c] sm:text-[2.7rem]">
                    {topKiller.unit_name}
                  </p>
                  <p className="mx-auto max-w-sm text-sm leading-6 text-[#4b3620] sm:text-[0.95rem]">
                    Seen in the company of the <span className="font-semibold">{topKiller.warband_name}</span>.
                    Report all sightings to the nearest torch-lit tavern wall.
                  </p>
                </div>
                <div className="mx-auto h-px w-24 bg-[#81633e]/35" />
              </div>
            </CardBackground>
          ) : (
            <CardBackground className="campaign-bulletin-poster p-5 sm:p-6">
              <p className="text-center text-sm text-[#4b3620]">No notorious soul identified yet.</p>
            </CardBackground>
          )}
        </section>

        <section aria-labelledby="most-dangerous-heading">
          {isTopKillersLoading ? (
            <LeaderboardSkeleton />
          ) : (
            <CardBackground className="campaign-bulletin-shell p-5 sm:p-6">
              <div className="space-y-4">
                <div className="flex items-baseline justify-between gap-4">
                  <h2
                    id="most-dangerous-heading"
                    className="font-serif text-2xl font-semibold tracking-[0.03em] text-[#eedcbb]"
                  >
                    Most Dangerous
                  </h2>
                  <p className="text-[0.68rem] uppercase tracking-[0.24em] text-[#bfa57f]">
                    Top 5
                  </p>
                </div>
                {topKillersError ? (
                  <p className="text-sm text-red-400">{topKillersError}</p>
                ) : sortedDangerousUnits.length === 0 ? (
                  <p className="text-sm text-[#c7b18f]">No kills recorded yet.</p>
                ) : (
                  <ol className="space-y-2" aria-label="Most dangerous units">
                    {sortedDangerousUnits.map((entry, index) => (
                      <li
                        key={`${entry.unit_kind}-${entry.unit_id}`}
                        className="flex items-center gap-3 rounded-xl border border-[#6f5332]/55 bg-[linear-gradient(180deg,rgba(33,20,12,0.92),rgba(14,8,5,0.96))] px-3 py-3"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#8e6c3f]/60 bg-[#2f1d10] text-sm font-semibold text-[#f1dfbe]">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#f4e5c5]">{entry.unit_name}</p>
                          <p className="truncate text-xs uppercase tracking-[0.14em] text-[#b99d77]">
                            {entry.warband_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#aa8c64]">Kills</p>
                          <p className="text-lg font-semibold text-[#f6e7c8]">{entry.kills}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </CardBackground>
          )}
        </section>
      </div>

      <section aria-labelledby="bulletin-board-heading">
        {isBulletinLoading ? (
          <BoardSkeleton />
        ) : (
          <CardBackground className="campaign-bulletin-board p-5 sm:p-6">
            <div className="space-y-5">
              <div className="flex items-baseline justify-between gap-4">
                <h2
                  id="bulletin-board-heading"
                  className="font-serif text-2xl font-semibold tracking-[0.03em] text-[#f0ddbe]"
                >
                  Bulletin Board
                </h2>
                <p className="text-[0.68rem] uppercase tracking-[0.24em] text-[#cda76b]">
                  Camp Gossip
                </p>
              </div>

              <form onSubmit={handleSubmit} className="campaign-bulletin-note space-y-3">
                <label htmlFor="campaign-bulletin-body" className="text-sm font-semibold text-[#2c1c11]">
                  Pin a note
                </label>
                <textarea
                  id="campaign-bulletin-body"
                  className="min-h-28 w-full rounded-xl border border-[#8d6a3e]/45 bg-[rgba(255,248,232,0.78)] px-4 py-3 text-sm leading-6 text-[#22150d] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] outline-none placeholder:text-[#7d6442] focus:border-[#6c4c28] focus:ring-2 focus:ring-[#7b5a33]/25"
                  placeholder="Looking for lucky charms, spare pistols, or trouble..."
                  maxLength={280}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    className={cn(
                      "text-xs uppercase tracking-[0.16em]",
                      remainingCharacters <= 20 ? "text-red-700" : "text-[#6a5032]"
                    )}
                  >
                    {remainingCharacters} characters left
                  </p>
                  <Button type="submit" variant="secondary" disabled={!draft.trim() || isCreatingBulletinEntry}>
                    {isCreatingBulletinEntry ? "Pinning..." : "Pin Note"}
                  </Button>
                </div>
              </form>

              {boardErrorMessage ? <p className="text-sm text-red-700">{boardErrorMessage}</p> : null}

              {bulletinEntries.length === 0 ? (
                <div className="campaign-bulletin-empty">
                  <p className="text-sm text-[#2c1c11]">The board is bare. Pin the first rumour.</p>
                </div>
              ) : (
                <ol className="grid gap-4 sm:grid-cols-2">
                  {bulletinEntries.map((entry, index) => {
                    const isOwnEntry = Boolean(user?.id && entry.user_id === user.id);
                    const isDeleting = deletingBulletinEntryIds.includes(entry.id);

                    return (
                      <li
                        key={entry.id}
                        className={cn(
                          "campaign-bulletin-note relative min-h-40",
                          index % 3 === 1 && "sm:rotate-[-1.2deg]",
                          index % 3 === 2 && "sm:rotate-[1.1deg]"
                        )}
                      >
                        <div className="flex h-full flex-col gap-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs uppercase tracking-[0.18em] text-[#694d2e]">
                                {entry.username}
                              </p>
                              <p className="text-[0.7rem] uppercase tracking-[0.14em] text-[#8a6b48]">
                                {formatBulletinDate(entry.created_at)}
                              </p>
                            </div>
                            {isOwnEntry ? (
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#8a6940]/45 bg-[rgba(71,44,24,0.08)] text-[#5a3920] transition hover:border-[#6d4a24] hover:bg-[rgba(71,44,24,0.16)]"
                                aria-label={`Delete bulletin note by ${entry.username}`}
                                disabled={isDeleting}
                                onClick={() => {
                                  void onDeleteBulletinEntry(entry.id).catch(() => undefined);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                          <p className="flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#24160d]">
                            {entry.body}
                          </p>
                          {isDeleting ? (
                            <p className="text-[0.7rem] uppercase tracking-[0.16em] text-[#7d5a32]">
                              Removing note...
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </CardBackground>
        )}
      </section>
    </div>
  );
}
