import { useEffect, useMemo, useState } from "react";

import { listWarbandLogs } from "../../api/warbands-api";
import { formatLogMessage } from "../../data/log-translations";

import type { Warband, WarbandLog } from "../../types/warband-types";

type LogsTabProps = {
  warband: Warband;
};

export default function LogsTab({ warband }: LogsTabProps) {
  const [logs, setLogs] = useState<WarbandLog[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [selectedFeature, setSelectedFeature] = useState("all");

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

  const formatLogLabel = (value: string) =>
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const formatLogLine = (log: WarbandLog) => {
    const payload = (log.payload ?? {}) as Record<string, unknown>;
    const translated = formatLogMessage(log.feature, log.entry_type, payload);
    if (translated) {
      return translated;
    }
    if (payload && typeof payload === "object") {
      const summary = payload.summary;
      if (typeof summary === "string" && summary.trim()) {
        return summary;
      }
      const subjectValue =
        payload.name ||
        payload.title ||
        payload.item ||
        payload.skill ||
        payload.hero ||
        payload.resource;
      if (typeof subjectValue === "string" && subjectValue.trim()) {
        return `${formatLogLabel(log.feature)}: ${formatLogLabel(log.entry_type)} ${subjectValue}`;
      }
      if (typeof subjectValue === "number") {
        return `${formatLogLabel(log.feature)}: ${formatLogLabel(log.entry_type)} ${subjectValue}`;
      }
    }
    return `${formatLogLabel(log.feature)}: ${formatLogLabel(log.entry_type)}`;
  };

  const formatLogDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
      return "";
    }
    return date.toLocaleDateString();
  };

  const warbandName = warband.name || "this warband";

  return (
    <div className="space-y-4">
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
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-border/60 bg-background/80 px-3 py-2 text-sm text-foreground"
            >
              <span>{formatLogLine(log)}</span>
              <span className="text-xs text-muted-foreground">
                {formatLogDate(log.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
