import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { warbandLogsQuery } from "../../api/economy-queries";
import { formatLogMessage } from "../../data/log-translations";
import { FEATURE_COLORS, DEFAULT_FEATURE_COLOR, LOG_FORMATTERS } from "../../data/log-formatters";

import type { Warband, WarbandLog } from "../../types/warband-types";

const NO_LOGS: WarbandLog[] = [];

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message || "Unable to load logs" : "Unable to load logs";

// Free-form log payload; these are the keys the generic (template) formatter reads directly.
type GenericLogPayload = Record<string, unknown> & {
  hero?: string;
  warband?: string;
  reason?: string;
  skill_type?: string;
  special_type?: string;
};

type LogsTabProps = {
  warband: Warband;
};

/**
 * The Logs tab: the warband's log a server page at a time (12 entries), newest first, filtered
 * on the server by feature (ECON-PERF-06). Pages already read are kept while the tab is hidden.
 */
export default function LogsTab({ warband }: LogsTabProps) {
  const [selectedFeature, setSelectedFeature] = useState("all");
  const [page, setPage] = useState(0);
  const feature = selectedFeature === "all" ? "" : selectedFeature;
  const logsQuery = useInfiniteQuery(warbandLogsQuery(warband.campaign_id, warband.id, feature));
  const pages = logsQuery.data?.pages;
  const paginatedLogs = pages?.[page]?.results ?? NO_LOGS;
  const isLogsLoading = logsQuery.isPending;
  const logsError = logsQuery.isError ? errorMessage(logsQuery.error) : "";
  const hasNextPage = page < (pages?.length ?? 0) - 1 || logsQuery.hasNextPage;

  // Another warband's logs start unfiltered.
  useEffect(() => {
    setSelectedFeature("all");
  }, [warband.id]);

  // The whole log's features, from its first page (sorted for the filter).
  const featureOptions = useMemo(
    () => [...(pages?.[0]?.features ?? [])].sort((a, b) => a.localeCompare(b)),
    [pages]
  );

  // Reset page when filter changes
  useEffect(() => {
    setPage(0);
  }, [selectedFeature]);

  /** The next page: read from the server the first time it is shown. */
  const handleNextPage = async () => {
    if (page >= (pages?.length ?? 0) - 1) {
      const next = await logsQuery.fetchNextPage();
      if (next.isError) {
        return;
      }
    }
    setPage((current) => current + 1);
  };

  const featureLabelMap: Record<string, string> = {
    advance: "Advances",
    battle: "Battle",
    loadout: "Loadout",
    dice_roll: "Dice Roll",
    personnel: "Personnel",
  };

  const formatLogLabel = (value: string) =>
    featureLabelMap[value] ??
    value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  const formatLogLine = (log: WarbandLog): ReactNode => {
    const key = `${log.feature}:${log.entry_type}`;
    const formatter = LOG_FORMATTERS[key];
    if (formatter) {
      return formatter(log);
    }

    const payload = (log.payload ?? {}) as GenericLogPayload;
    const actor = payload.hero || payload.warband || "Warband";
    const reasonSuffix = payload.reason ? ` (${payload.reason})` : "";

    const translated = formatLogMessage(log.feature, log.entry_type, {
      ...payload,
      actor,
      reason_suffix: reasonSuffix,
      item_suffix: "",
      skill_type: payload.skill_type || "general",
      special_type: payload.special_type || "special",
    });
    return translated || `${formatLogLabel(log.feature)}: ${formatLogLabel(log.entry_type)}`;
  };

  const formatLogDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
      return "";
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
    });
  };

  return (
    <div className="relative space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="min-w-[180px]">
          <select
            className="w-full border border-border/60 bg-background/80 px-3 py-2 text-sm text-foreground"
            value={selectedFeature}
            onChange={(event) => setSelectedFeature(event.target.value)}
          >
            <option value="all">All features</option>
            {featureOptions.map((feature) => (
              <option key={feature} value={feature}>
                {formatLogLabel(feature)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-black/20">
        {isLogsLoading ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">Gathering log entries...</p>
        ) : logsError && !pages ? (
          <p className="px-3 py-3 text-sm text-red-600">{logsError}</p>
        ) : paginatedLogs.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">No log entries yet.</p>
        ) : (
          <div className="space-y-0">
            {paginatedLogs.map((log, index) => (
              <div
                key={log.id}
                className="flex items-center gap-3 border-b border-border/30 px-3 py-2.5 text-sm text-foreground transition-[filter] hover:brightness-110 last:border-b-0"
                style={{
                  backgroundColor:
                    index % 2 === 0 ? "rgba(16, 12, 9, 0.5)" : "rgba(22, 16, 12, 0.75)",
                }}
              >
                <span className="w-10 shrink-0 text-xs text-muted-foreground">
                  {formatLogDate(log.created_at)}
                </span>
                <div className="w-px shrink-0 self-stretch bg-border/30" aria-hidden="true" />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider ${FEATURE_COLORS[log.feature] ?? DEFAULT_FEATURE_COLOR}`}
                  >
                    {formatLogLabel(log.feature)}
                  </span>
                  <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                    {formatLogLine(log)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pages && logsError ? <p className="text-center text-xs text-red-600">{logsError}</p> : null}
      {page > 0 || hasNextPage ? (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            type="button"
            className="rounded border border-border/60 p-1.5 text-muted-foreground transition-colors duration-150 hover:border-white/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border/60 disabled:hover:text-muted-foreground"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <button
            type="button"
            className="rounded border border-border/60 p-1.5 text-muted-foreground transition-colors duration-150 hover:border-white/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border/60 disabled:hover:text-muted-foreground"
            disabled={!hasNextPage || logsQuery.isFetchingNextPage}
            onClick={() => void handleNextPage()}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
