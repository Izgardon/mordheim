import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { listWarbandLogs } from "../../api/warbands-api";
import { formatLogMessage } from "../../data/log-translations";
import { FEATURE_COLORS, DEFAULT_FEATURE_COLOR, LOG_FORMATTERS } from "../../data/log-formatters";

import { CardBackground } from "@components/card-background";
import type { Warband, WarbandLog } from "../../types/warband-types";
import basicBar from "@/assets/containers/basic_bar.webp";

const LOGS_PER_PAGE = 12;

const ROW_BG: CSSProperties = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
};

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
    loadout: "Loadout",
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
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const warbandName = warband.name || "this warband";

  return (
    <CardBackground className="space-y-4 p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-baseline gap-2 text-foreground">
            <span className="text-sm font-semibold tracking-[0.2em] text-muted-foreground">
              The journey of
            </span>
            <span className="text-2xl font-semibold">{warbandName}</span>
          </h2>
        </div>
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

      {isLogsLoading ? (
        <p className="text-sm text-muted-foreground">Gathering log entries...</p>
      ) : logsError ? (
        <p className="text-sm text-red-600">{logsError}</p>
      ) : filteredLogs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No log entries yet.</p>
      ) : (
        <div className="space-y-0">
          {paginatedLogs.map((log, index) => (
            <div
              key={log.id}
              className="flex flex-wrap items-center gap-3 border-b border-border/30 px-3 py-2.5 text-sm text-foreground transition-[filter] hover:brightness-110"
              style={{
                ...ROW_BG,
                backgroundImage:
                  index % 2 === 0
                    ? `linear-gradient(rgba(255,255,255,0.02), rgba(255,255,255,0.02)), ${ROW_BG.backgroundImage}`
                    : `linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.05)), ${ROW_BG.backgroundImage}`,
              }}
            >
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider ${FEATURE_COLORS[log.feature] ?? DEFAULT_FEATURE_COLOR}`}
              >
                {formatLogLabel(log.feature)}
              </span>
              <span className="min-w-0 flex-1">{formatLogLine(log)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatLogDate(log.created_at)}
              </span>
            </div>
          ))}

          {totalPages > 1 && (
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
          )}
        </div>
      )}
    </CardBackground>
  );
}
