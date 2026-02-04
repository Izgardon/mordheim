import { useEffect, useMemo, useState, type ReactNode } from "react";

import { listWarbandLogs } from "../../api/warbands-api";
import { formatLogMessage } from "../../data/log-translations";

import type { Warband, WarbandLog } from "../../types/warband-types";
import needIcon from "@/assets/icons/need.png";

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

  const featureLabelMap: Record<string, string> = {
    advance: "Advances",
    loadout: "Builds",
  };

  const formatLogLabel = (value: string) =>
    featureLabelMap[value] ??
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const renderDiceBadge = (dice?: string) => (
    <span className="inline-flex items-center gap-1 align-middle leading-none">
      <img src={needIcon} alt="" className="relative top-[1px] h-4 w-4" />
      {dice ? <span>{dice}</span> : null}
    </span>
  );

  const formatLogLine = (log: WarbandLog): ReactNode => {
    const payload = (log.payload ?? {}) as Record<string, unknown>;

    if (log.feature === "advance" && log.entry_type === "hero") {
      const payloadRecord = payload && typeof payload === "object" ? payload : {};
      const heroName =
        typeof payloadRecord.hero === "string" && payloadRecord.hero.trim()
          ? payloadRecord.hero
          : "Unknown Hero";
      const advanceRecord =
        payloadRecord.advance && typeof payloadRecord.advance === "object"
          ? (payloadRecord.advance as Record<string, unknown>)
          : null;
      const advanceLabel =
        (advanceRecord && typeof advanceRecord.label === "string" && advanceRecord.label) ||
        (typeof payloadRecord.advance === "string" ? payloadRecord.advance : "Advance");

      const roll1 =
        payloadRecord.roll1 && typeof payloadRecord.roll1 === "object"
          ? (payloadRecord.roll1 as Record<string, unknown>)
          : null;
      const roll2 =
        payloadRecord.roll2 && typeof payloadRecord.roll2 === "object"
          ? (payloadRecord.roll2 as Record<string, unknown>)
          : null;

      const roll1Result =
        roll1?.result && typeof roll1.result === "object"
          ? (roll1.result as Record<string, unknown>)
          : null;
      const roll2Result =
        roll2?.result && typeof roll2.result === "object"
          ? (roll2.result as Record<string, unknown>)
          : null;

      const roll1Total = typeof roll1Result?.total === "number" ? roll1Result.total : null;
      const roll2Total = typeof roll2Result?.total === "number" ? roll2Result.total : null;
      const roll1Dice = typeof roll1?.dice === "string" ? roll1.dice : undefined;
      const roll2Dice = typeof roll2?.dice === "string" ? roll2.dice : undefined;

      if (roll1Total === null && roll2Total === null) {
        return `${heroName} levelled up and gained a ${advanceLabel}`;
      }

      if (roll1Total !== null && roll2Total === null) {
        return (
          <>
            {heroName} levelled up with a roll of {roll1Total} (
            {renderDiceBadge(roll1Dice)}) and gained a {advanceLabel}
          </>
        );
      }

      if (roll1Total !== null && roll2Total !== null) {
        return (
          <>
            {heroName} levelled up with a roll of {roll1Total} (
            {renderDiceBadge(roll1Dice)}), followed by a {roll2Total} (
            {renderDiceBadge(roll2Dice)}) and gained a {advanceLabel}
          </>
        );
      }
    }

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

