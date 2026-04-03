import { useState, type FormEvent } from "react";

import { Plus, Trash2 } from "lucide-react";

import wantedPosterImage from "@/assets/containers/wanted_poster.png";
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

function BoardSkeleton() {
  return (
    <CardBackground className="campaign-bulletin-board p-4 sm:p-5">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-6 w-40 animate-pulse rounded bg-black/20" />
          <div className="h-9 w-24 animate-pulse rounded bg-black/20" />
        </div>
        <div className="campaign-bulletin-scroll space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-md bg-black/15" />
          ))}
        </div>
      </div>
    </CardBackground>
  );
}

function PosterSkeleton() {
  return (
    <div className="campaign-bulletin-poster-shell animate-pulse">
      <div className="campaign-bulletin-poster-copy bg-black/10" />
    </div>
  );
}

function MostDangerousSkeleton() {
  return (
    <div className="table-shell overflow-hidden rounded-2xl">
      <div className="scrollbar-hidden-mobile overflow-x-auto">
        <table className="w-full text-left text-sm text-foreground">
          <thead>
            <tr className="table-head-surface border-b border-border/40 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              <th className="px-3 py-3 text-left font-semibold sm:px-4">Unit</th>
              <th className="px-3 py-3 text-left font-semibold sm:px-4">Warband</th>
              <th className="px-3 py-3 text-right font-semibold sm:px-4">Kills</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, index) => (
              <tr key={index} className={index % 2 === 0 ? "table-row-even" : "table-row-odd"}>
                <td className="px-3 py-3 sm:px-4">
                  <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
                </td>
                <td className="px-3 py-3 sm:px-4">
                  <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
                </td>
                <td className="px-3 py-3 text-right sm:px-4">
                  <div className="ml-auto h-4 w-8 animate-pulse rounded bg-white/10" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const { user } = useAppStore();

  const topKiller = topKillers[0] ?? null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isCreatingBulletinEntry) {
      return;
    }

    try {
      await onCreateBulletinEntry(trimmed);
      setDraft("");
      setIsComposerOpen(false);
    } catch {
      // Error state is managed by the hook.
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start">
      <section aria-labelledby="bulletin-board-heading" className="min-h-0">
        {isBulletinLoading ? (
          <BoardSkeleton />
        ) : (
          <CardBackground className="campaign-bulletin-board p-4 sm:p-5">
            <div className="flex h-full min-h-[28rem] flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h2
                  id="bulletin-board-heading"
                  className="font-serif text-2xl font-semibold tracking-[0.03em] text-[#f2dfbc]"
                >
                  Bulletin Board
                </h2>
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setIsComposerOpen((prev) => !prev)}
                  aria-expanded={isComposerOpen}
                  aria-controls="campaign-bulletin-composer"
                >
                  <Plus className="h-4 w-4" />
                  {isComposerOpen ? "Close" : "Add Note"}
                </Button>
              </div>

              {isComposerOpen ? (
                <form
                  id="campaign-bulletin-composer"
                  onSubmit={handleSubmit}
                  className="rounded-md border border-[#6c4a27]/70 bg-black/20 p-3"
                >
                  <label htmlFor="campaign-bulletin-body" className="sr-only">
                    Bulletin note
                  </label>
                  <textarea
                    id="campaign-bulletin-body"
                    className="min-h-24 w-full rounded-md border border-[#7b552c]/65 bg-[rgba(18,11,7,0.8)] px-3 py-2 text-sm text-[#f3e5cb] outline-none placeholder:text-[#b7976b] focus:border-[#a9773c] focus:ring-2 focus:ring-[#a9773c]/25"
                    placeholder="Write a note..."
                    maxLength={280}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <div className="mt-3 flex justify-end">
                    <Button type="submit" variant="secondary" size="sm" disabled={!draft.trim() || isCreatingBulletinEntry}>
                      {isCreatingBulletinEntry ? "Adding..." : "Post"}
                    </Button>
                  </div>
                </form>
              ) : null}

              {bulletinError || bulletinActionError ? (
                <p className="text-sm text-red-300">{bulletinError || bulletinActionError}</p>
              ) : null}

              <div className="campaign-bulletin-scroll scrollbar-hidden-mobile min-h-0 flex-1 overflow-y-auto pr-1">
                <ol className="space-y-2">
                  {bulletinEntries.map((entry, index) => {
                    const isOwnEntry = Boolean(user?.id && entry.user_id === user.id);
                    const isDeleting = deletingBulletinEntryIds.includes(entry.id);

                    return (
                      <li
                        key={entry.id}
                        className={cn(
                          "border-b border-[#6b4724]/55 px-1 py-2 last:border-b-0",
                          index === 0 && "pt-0"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#f2dfbf]">
                              {entry.body}
                            </p>
                          </div>
                          {isOwnEntry ? (
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#6f4b29]/65 bg-black/15 text-[#d8b17b] transition hover:border-[#9a6f3d] hover:text-[#f0d3a4]"
                              aria-label={`Delete bulletin note ${entry.id}`}
                              disabled={isDeleting}
                              onClick={() => {
                                void onDeleteBulletinEntry(entry.id).catch(() => undefined);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </CardBackground>
        )}
      </section>

      <div className="space-y-5">
        <section aria-label="Wanted poster">
          {isTopKillersLoading ? (
            <PosterSkeleton />
          ) : (
            <div
              className="campaign-bulletin-poster-shell"
              style={{ backgroundImage: `url(${wantedPosterImage})` }}
            >
              <div className="campaign-bulletin-poster-copy">
                <p className="campaign-bulletin-poster-name">{topKillersError ? "" : topKiller?.unit_name ?? ""}</p>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="most-dangerous-heading">
          <div className="space-y-3">
            <h2 id="most-dangerous-heading" className="text-base font-semibold text-foreground">
              Most Dangerous
            </h2>
            {isTopKillersLoading ? (
              <MostDangerousSkeleton />
            ) : topKillersError ? (
              <p className="text-sm text-red-600">{topKillersError}</p>
            ) : (
              <div className="table-shell overflow-hidden rounded-2xl">
                <div className="scrollbar-hidden-mobile overflow-x-auto">
                  <table className="w-full text-left text-sm text-foreground">
                    <thead>
                      <tr className="table-head-surface border-b border-border/40 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                        <th className="px-3 py-3 text-left font-semibold sm:px-4">Unit</th>
                        <th className="px-3 py-3 text-left font-semibold sm:px-4">Warband</th>
                        <th className="px-3 py-3 text-right font-semibold sm:px-4">Kills</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topKillers.slice(0, 5).map((entry, index) => (
                        <tr
                          key={`${entry.unit_kind}-${entry.unit_id}`}
                          className={cn(
                            "border-b border-border/40 transition-colors last:border-b-0",
                            index % 2 === 0 ? "table-row-even table-row-hover" : "table-row-odd table-row-hover"
                          )}
                        >
                          <td className="px-3 py-3 font-medium text-foreground sm:px-4">{entry.unit_name}</td>
                          <td className="px-3 py-3 text-muted-foreground sm:px-4">{entry.warband_name}</td>
                          <td className="px-3 py-3 text-right text-foreground sm:px-4">{entry.kills}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
