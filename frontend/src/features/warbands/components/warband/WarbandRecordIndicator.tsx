import { Skull, Swords, Trophy } from "lucide-react";

import { Tooltip } from "@components/tooltip";
import { cn } from "@/lib/utils";

type WarbandRecordIndicatorProps = {
  wins?: number | null;
  losses?: number | null;
  variant?: "desktop" | "mobile";
  className?: string;
  triggerClassName?: string;
};

function normalizeRecordValue(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

export default function WarbandRecordIndicator({
  wins,
  losses,
  variant = "desktop",
  className,
  triggerClassName,
}: WarbandRecordIndicatorProps) {
  const resolvedWins = normalizeRecordValue(wins);
  const resolvedLosses = normalizeRecordValue(losses);
  const battlesFought = resolvedWins + resolvedLosses;
  const ariaLabel = `Battles fought: ${battlesFought}. Wins: ${resolvedWins}. Losses: ${resolvedLosses}.`;

  return (
    <Tooltip
      className={cn("inline-flex", className)}
      aria-label={ariaLabel}
      trigger={
        <div
          className={cn(
            variant === "desktop"
              ? "btn-toolbar inline-flex h-9 w-[5.5rem] items-center justify-start gap-2 px-3 text-xs tabular-nums"
              : "inline-flex items-center gap-2 text-xs font-semibold",
            "select-none",
            triggerClassName
          )}
        >
          <Swords
            className={cn(
              "shrink-0",
              variant === "desktop" ? "h-4 w-4 text-[color:var(--color-icon-soft)]" : "theme-icon-soft h-4 w-4"
            )}
            aria-hidden="true"
          />
          <span>{battlesFought}</span>
        </div>
      }
      content={
        <div className="space-y-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Warband Record
          </p>
          <div className="flex items-center justify-between gap-6 text-sm">
            <span className="inline-flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-[#d4af37]" aria-hidden="true" />
              Wins
            </span>
            <span className="font-semibold">{resolvedWins}</span>
          </div>
          <div className="flex items-center justify-between gap-6 text-sm">
            <span className="inline-flex items-center gap-2">
              <Skull className="h-3.5 w-3.5 text-rose-300" aria-hidden="true" />
              Losses
            </span>
            <span className="font-semibold">{resolvedLosses}</span>
          </div>
        </div>
      }
      maxWidth={220}
    />
  );
}
