import { useCallback, useState, type ReactNode } from "react";

import { Tooltip } from "@/components/ui/tooltip";
import type { NamedKillHistory } from "@/features/warbands/types/warband-types";

type UnitKillHistoryTooltipProps = {
  totalKills: number;
  loadKillHistory: () => Promise<NamedKillHistory>;
  children: ReactNode;
  ariaLabel: string;
};

export default function UnitKillHistoryTooltip({
  totalKills,
  loadKillHistory,
  children,
  ariaLabel,
}: UnitKillHistoryTooltipProps) {
  const [killHistory, setKillHistory] = useState<NamedKillHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open || killHistory || isLoading) {
        return;
      }
      setIsLoading(true);
      setError("");
      void loadKillHistory()
        .then((response) => {
          setKillHistory(response);
        })
        .catch((errorResponse) => {
          if (errorResponse instanceof Error) {
            setError(errorResponse.message || "Unable to load named kills");
          } else {
            setError("Unable to load named kills");
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [isLoading, killHistory, loadKillHistory]
  );

  const content = (
    <div className="space-y-2 not-italic text-[#2a1f1a]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5c3a2b]">
        Named kills ({killHistory?.named_kills_count ?? 0}/{killHistory?.total_kills ?? totalKills})
      </p>
      {isLoading ? <p className="text-sm">Loading named kills...</p> : null}
      {!isLoading && error ? <p className="text-sm">Unable to load named kills</p> : null}
      {!isLoading && !error && killHistory && killHistory.named_kills.length === 0 ? (
        <p className="text-sm">No named kills recorded.</p>
      ) : null}
      {!isLoading && !error && killHistory && killHistory.named_kills.length > 0 ? (
        <ul className="space-y-2 text-sm leading-relaxed">
          {killHistory.named_kills.map((entry, index) => {
            const scenarioName = entry.scenario_name.trim() || "an unknown scenario";
            return (
              <li key={`${entry.victim_name}-${entry.victim_warband_name}-${scenarioName}-${index}`}>
                {`Killed ${entry.victim_name} of ${entry.victim_warband_name} during ${scenarioName}`}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );

  return (
    <Tooltip
      trigger={
        <button
          type="button"
          aria-label={ariaLabel}
          className="cursor-pointer border-none bg-transparent p-0 text-inherit"
        >
          {children}
        </button>
      }
      content={content}
      contentClassName="tooltip-unfurl fixed z-[60] rounded-md bg-cover bg-center bg-no-repeat p-4 text-sm text-[#2a1f1a] shadow-lg overflow-y-auto"
      minWidth={220}
      maxWidth={360}
      maxHeight="18rem"
      openOnHover={false}
      onOpenChange={handleOpenChange}
    />
  );
}
