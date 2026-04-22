import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { listWarbandLogs } from "../../api/warbands-api";
import { formatLogMessage } from "../../data/log-translations";
import { FEATURE_COLORS, DEFAULT_FEATURE_COLOR, LOG_FORMATTERS } from "../../data/log-formatters";

import type { Warband, WarbandLog } from "../../types/warband-types";

const LOGS_PER_PAGE = 12;

type LogsTabProps = {
  warband: Warband;
};

export default function LogsTab({ warband }: LogsTabProps) {
  const [logs, setLogs] = useState<WarbandLog[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [selectedFeature, setSelectedFeature] = useState("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let isActive = true;

    setIsLogsLoading(true);
    setLogsError("");
    setSelectedFeature("all");
    listWarbandLogs(warband.id)
      .then((data) => {
        if (!isActive) {
          return;
        }
        setLogs(data);
      })
      .catch((errorResponse) => {
        if (!isActive) {
          return;
        }
        if (errorResponse instanceof Error) {
          setLogsError(errorResponse.message || "Unable to load logs");
        } else {
          setLogsError("Unable to load logs");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLogsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [warband.id]);

  const featureOptions = useMemo(() => {
    const unique = new Set(logs.map((log) => log.feature).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (selectedFeature === "all") {
      return logs;
    }
    return logs.filter((log) => log.feature === selectedFeature);
  }, [logs, selectedFeature]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(0);
  }, [selectedFeature]);

  const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    page * LOGS_PER_PAGE,
    (page + 1) * LOGS_PER_PAGE
  );

  const featureLabelMap: Record<string, string> = {
    advance: "Advances",
    battle: "Battle",
    loadout: "Loadout",
    dice_roll: "Dice Roll",
    personnel: "Personnel",
  };

  const formatLogLabel = (value: string) =>
    featureLabelMap[value] ??
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const formatLogLine = (log: WarbandLog): ReactNode => {
    const key = `${log.feature}:${log.entry_type}`;
    const formatter = LOG_FORMATTERS[key];
    if (formatter) {
      return formatter(log);
    }

    const payload = (log.payload ?? {}) as Record<string, any>;
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
        ) : logsError ? (
          <p className="px-3 py-3 text-sm text-red-600">{logsError}</p>
        ) : filteredLogs.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">No log entries yet.</p>
        ) : (
          <div className="space-y-0">
            {paginatedLogs.map((log, index) => (
              <div
                key={log.id}
                className="flex items-center gap-3 border-b border-border/30 px-3 py-2.5 text-sm text-foreground transition-[filter] hover:brightness-110 last:border-b-0"
                style={{
                  backgroundColor:
                    index % 2 === 0
                      ? "rgba(16, 12, 9, 0.5)"
                      : "rgba(22, 16, 12, 0.75)",
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

      {filteredLogs.length > 0 && totalPages > 1 ? (
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
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            className="rounded border border-border/60 p-1.5 text-muted-foreground transition-colors duration-150 hover:border-white/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border/60 disabled:hover:text-muted-foreground"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
