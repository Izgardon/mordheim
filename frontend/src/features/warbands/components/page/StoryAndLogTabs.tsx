import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";

import { warbandLogsQuery } from "../../api/economy-queries";
import { LOG_FORMATTERS } from "../../data/log-formatters";
import { formatLogMessage } from "../../data/log-translations";
import { useBackstory } from "../../hooks/warband/useBackstory";
import { formatTradeDate, logFeatureLabel } from "../../utils/warband-utils";
import type { Warband, WarbandLog } from "../../types/warband-types";

/** The warband's story: read, or edited in place by those who may. */
export function BackstoryTab({
  warband,
  canEdit,
  onWarbandUpdated,
}: {
  warband: Warband;
  canEdit: boolean;
  onWarbandUpdated: (warband: Warband) => void;
}) {
  const story = useBackstory({ warband, canEdit, onWarbandUpdated });
  if (story.isEditingBackstory) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          aria-label="Backstory"
          value={story.backstoryDraft}
          onChange={(event) => story.setBackstoryDraft(event.target.value)}
          className="min-h-[240px] border border-strong bg-page p-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        />
        {story.backstoryError ? (
          <p className="text-sm text-danger">{story.backstoryError}</p>
        ) : null}
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={story.isSavingBackstory}
            onClick={() => void story.handleSaveBackstory()}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={story.cancelEditing}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="whitespace-pre-line text-[15px] leading-relaxed text-text2">
        {warband.backstory?.trim() || "No story written yet."}
      </p>
      {canEdit ? (
        <Button size="sm" variant="secondary" className="self-start" onClick={story.startEditing}>
          Edit the story
        </Button>
      ) : null}
    </div>
  );
}

const describe = (log: WarbandLog) =>
  LOG_FORMATTERS[`${log.feature}:${log.entry_type}`]?.(log) ??
  formatLogMessage(log.feature, log.entry_type, log.payload ?? {});

/** The warband log, newest first, a page at a time, filtered by feature. */
export function LogTab({ campaignId, warbandId }: { campaignId: number; warbandId: number }) {
  const [feature, setFeature] = useState("");
  const logs = useInfiniteQuery(warbandLogsQuery(campaignId, warbandId, feature));
  const features = logs.data?.pages[0]?.features ?? [];
  const entries = logs.data?.pages.flatMap((page) => page.results) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {features.length ? (
        <div role="group" aria-label="Filter the log" className="flex flex-wrap gap-1.5">
          {["", ...features].map((name) => (
            <Chip key={name || "all"} pressed={feature === name} onClick={() => setFeature(name)}>
              {name ? logFeatureLabel(name) : "All"}
            </Chip>
          ))}
        </div>
      ) : null}
      {logs.isPending ? <p className="text-sm text-muted-foreground">Reading the log…</p> : null}
      <ul className="m-0 flex list-none flex-col border-t border-line p-0">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-0.5 border-b border-line py-2.5">
            <span className="text-sm text-ink">{describe(entry)}</span>
            <span className="text-xs text-muted-foreground">
              {formatTradeDate(entry.created_at)}
            </span>
          </li>
        ))}
      </ul>
      {logs.hasNextPage ? (
        <Button
          variant="secondary"
          className="self-center"
          disabled={logs.isFetchingNextPage}
          onClick={() => void logs.fetchNextPage()}
        >
          Older entries
        </Button>
      ) : null}
    </div>
  );
}
