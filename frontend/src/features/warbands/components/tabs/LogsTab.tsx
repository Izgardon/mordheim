import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";

import { listWarbandLogs } from "../../api/warbands-api";
import { formatLogMessage } from "../../data/log-translations";

import { CardBackground } from "@components/card-background";
import type { Warband, WarbandLog } from "../../types/warband-types";
import needIcon from "@/assets/icons/need.webp";
import greedIcon from "@/assets/icons/greed.webp";
import basicBar from "@/assets/containers/basic_bar.webp";

const LOGS_PER_PAGE = 12;

const ROW_BG: CSSProperties = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
};

const FEATURE_COLORS: Record<string, string> = {
  advance: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  loadout: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  trading_action: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  warband: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  hero: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  campaign: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
};

const DEFAULT_FEATURE_COLOR = "bg-white/10 text-muted-foreground border-white/20";

const renderDiceBadge = (dice?: string) => (
  <span className="inline-flex items-center gap-1 align-middle leading-none">
    <img src={needIcon} alt="" className="relative top-[1px] h-4 w-4" />
    {dice ? <span>{dice}</span> : null}
  </span>
);

const renderGoldBadge = (value: number) => (
  <span className="inline-flex items-center gap-1 align-middle leading-none">
    <img src={greedIcon} alt="" className="relative top-[1px] h-4 w-4" />
    <span>{value} gc</span>
  </span>
);

type LogFormatter = (log: WarbandLog) => ReactNode;

const LOG_FORMATTERS: Record<string, LogFormatter> = {
  "advance:hero": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const heroName = payload.hero || "Unknown Hero";
    const advanceLabel = payload.advance?.label || payload.advance || "Advance";
    const roll1Total = payload.roll1?.result?.total ?? null;
    const roll2Total = payload.roll2?.result?.total ?? null;
    const roll1Dice = payload.roll1?.dice;
    const roll2Dice = payload.roll2?.dice;

    if (roll1Total === null && roll2Total === null) {
      return `${heroName} levelled up and gained a ${advanceLabel}`;
    }
    if (roll2Total === null) {
      return (
        <>
          {heroName} levelled up with a roll of {roll1Total} (
          {renderDiceBadge(roll1Dice)}) and gained a {advanceLabel}
        </>
      );
    }
    return (
      <>
        {heroName} levelled up with a roll of {roll1Total} (
        {renderDiceBadge(roll1Dice)}), followed by a {roll2Total} (
        {renderDiceBadge(roll2Dice)}) and gained a {advanceLabel}
      </>
    );
  },

  "trading_action:rarity roll": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const heroName = payload.hero || "Unknown Hero";
    const itemName = payload.item || "Unknown Item";
    const rarityLabel = payload.rarity === 2 ? "Common" : String(payload.rarity ?? "?");
    const rollValue = payload.roll ?? "-";
    const modifierRaw = payload.modifier ?? 0;
    const modifierValue = Number(modifierRaw);
    const hasModifier = Number.isFinite(modifierValue) && modifierValue !== 0;
    const modifierText = hasModifier
      ? modifierValue >= 0
        ? `+${modifierValue}`
        : `-${Math.abs(modifierValue)}`
      : "";
    const rawReason =
      typeof payload.reason === "string" ? payload.reason.trim() : "";
    const cleanedReason =
      rawReason && rawReason !== "No modifier" ? rawReason : "";
    const reasonSuffix = cleanedReason ? ` (${cleanedReason})` : "";
    const success = payload.success;
    const resultIcon =
      success === undefined
        ? null
        : success
          ? <Check className="h-4 w-4 text-emerald-400" />
          : <X className="h-4 w-4 text-red-400" />;

    const translated = formatLogMessage("trading_action", "rarity roll", {
      hero: heroName,
      item: itemName,
      rarity: rarityLabel,
      roll: rollValue,
      modifier_text: hasModifier ? modifierText : "",
      reason_suffix: reasonSuffix,
    });

    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span>
          {heroName} searched for: {itemName} [{rarityLabel}] - Roll {rollValue}
          {" "}({renderDiceBadge("2D6")})
          {hasModifier ? modifierText : ""}{reasonSuffix}
        </span>
        {resultIcon}
      </span>
    );
  },

  "loadout:hero_item": (log) => {
    const payload = (log.payload ?? {}) as Record<string, any>;
    const actor = payload.hero || payload.warband || "Warband";
    const itemPriceRaw = payload.price ?? 0;
    const itemPrice = Number(itemPriceRaw);
    const reasonText = payload.reason || "No reason given";

    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span>{actor} received: {payload.item}</span>
        {Number.isFinite(itemPrice) && itemPrice > 0
          ? (
            <span className="inline-flex items-center gap-1">
              <span>(</span>
              {renderGoldBadge(itemPrice)}
              <span>)</span>
            </span>
          )
          : <span>({reasonText})</span>}
      </span>
    );
  },
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
      feature_type: payload.feature_type || "feature",
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
