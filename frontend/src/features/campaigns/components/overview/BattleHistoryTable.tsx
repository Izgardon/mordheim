import { Fragment, useMemo, useState, type ReactNode } from "react";

import { ChevronDown } from "lucide-react";

import { RosterSkeleton } from "@components/card-skeleton";
import { useAuth } from "@/features/auth/hooks/use-auth";

import { BattleHistoryDetailTable, BattleHistoryMobileDetail } from "./BattleHistoryDetails";

import type { CampaignBattleHistoryEntry, CampaignPlayer } from "../../types/campaign-types";

type BattleHistoryTableProps = {
  isLoading: boolean;
  error: string;
  battles: CampaignBattleHistoryEntry[];
  players: CampaignPlayer[];
  isMobile: boolean;
  mobileExpanded: boolean;
  onToggleMobileExpanded: () => void;
  /** Shown under a battle's details (Edit record for battle managers, BATL-NEW-04). */
  renderBattleActions?: (battle: CampaignBattleHistoryEntry) => ReactNode;
};

const getInitialWarbandId = (
  battle: CampaignBattleHistoryEntry,
  currentUserWarbandId: number | null
) => {
  if (
    typeof currentUserWarbandId === "number" &&
    battle.participants.some((participant) => participant.warband_id === currentUserWarbandId)
  ) {
    return String(currentUserWarbandId);
  }
  const fallbackParticipant = battle.participants[0];
  return fallbackParticipant ? String(fallbackParticipant.warband_id) : "";
};

export default function BattleHistoryTable({
  isLoading,
  error,
  battles,
  players,
  isMobile,
  mobileExpanded,
  onToggleMobileExpanded,
  renderBattleActions,
}: BattleHistoryTableProps) {
  const { user } = useAuth();
  const [expandedBattleIds, setExpandedBattleIds] = useState<number[]>([]);
  const [selectedWarbandByBattleId, setSelectedWarbandByBattleId] = useState<
    Record<number, string>
  >({});

  const currentUserWarbandId = useMemo(() => {
    const player = players.find((entry) => entry.id === user?.id);
    return player?.warband?.id ?? null;
  }, [players, user?.id]);

  const toggleBattle = (battle: CampaignBattleHistoryEntry) => {
    setExpandedBattleIds((prev) => {
      const isExpanded = prev.includes(battle.id);
      if (isExpanded) {
        return prev.filter((entry) => entry !== battle.id);
      }
      return [...prev, battle.id];
    });
    setSelectedWarbandByBattleId((prev) => {
      if (prev[battle.id]) {
        return prev;
      }
      return {
        ...prev,
        [battle.id]: getInitialWarbandId(battle, currentUserWarbandId),
      };
    });
  };

  return (
    <section className="w-full space-y-3">
      {isMobile ? (
        <button
          type="button"
          onClick={onToggleMobileExpanded}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={mobileExpanded}
        >
          <h2 className="text-base font-semibold text-foreground">Battle History</h2>
          <ChevronDown
            className={`h-5 w-5 shrink-0 transition-transform ${
              mobileExpanded ? "rotate-0 text-foreground" : "-rotate-90 text-muted-foreground"
            }`}
            aria-hidden="true"
          />
        </button>
      ) : (
        <h2 className="text-base font-semibold text-foreground">Battle History</h2>
      )}
      {!isMobile || mobileExpanded ? (
        <>
          {isLoading ? (
            <RosterSkeleton rows={4} />
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : battles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No battles completed yet.</p>
          ) : (
            <div className="table-shell overflow-hidden rounded-2xl">
              <div className="scrollbar-hidden-mobile max-h-[500px] overflow-x-auto overflow-y-auto">
                <table className="w-full table-fixed sm:table-auto text-left text-sm text-foreground">
                  <thead className="sticky top-0 z-20">
                    <tr className="table-head-surface border-b border-border/40 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                      <th className="table-head-surface w-8 px-2 py-2 text-left font-semibold sm:w-10 sm:px-4 sm:py-3">
                        <span className="sr-only">Expand</span>
                      </th>
                      <th className="table-head-surface w-[44%] px-2 py-2 text-left font-semibold sm:w-auto sm:px-4 sm:py-3">
                        Scenario
                      </th>
                      <th className="table-head-surface w-[40%] px-2 py-2 text-left font-semibold sm:w-auto sm:px-4 sm:py-3">
                        Winners
                      </th>
                      {!isMobile ? (
                        <th className="table-head-surface px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">
                          Date
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {battles.map((battle, index) => {
                      const isExpanded = expandedBattleIds.includes(battle.id);
                      const selectedWarbandId =
                        selectedWarbandByBattleId[battle.id] ??
                        getInitialWarbandId(battle, currentUserWarbandId);
                      return (
                        <Fragment key={battle.id}>
                          <tr
                            className={[
                              "cursor-pointer border-b border-border/40 transition-colors",
                              index % 2 === 0
                                ? "table-row-even table-row-hover"
                                : "table-row-odd table-row-hover",
                            ].join(" ")}
                            onClick={() => toggleBattle(battle)}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleBattle(battle);
                              }
                            }}
                          >
                            <td className="px-2 py-2 align-middle sm:px-4 sm:py-3">
                              <ChevronDown
                                className={[
                                  "h-4 w-4 transition-transform",
                                  isExpanded
                                    ? "rotate-0 text-foreground"
                                    : "-rotate-90 text-muted-foreground",
                                ].join(" ")}
                                aria-hidden="true"
                              />
                            </td>
                            <td className="min-w-0 px-2 py-2 align-middle sm:px-4 sm:py-3">
                              <span className="block break-words whitespace-normal text-foreground sm:max-w-none sm:truncate sm:whitespace-nowrap">
                                {battle.scenario || "-"}
                              </span>
                            </td>
                            <td className="min-w-0 px-2 py-2 align-middle text-muted-foreground sm:px-4 sm:py-3">
                              <span className="block break-words whitespace-normal sm:max-w-none sm:truncate sm:whitespace-nowrap">
                                {battle.winners.length > 0 ? battle.winners.join(", ") : "-"}
                              </span>
                            </td>
                            {!isMobile ? (
                              <td className="px-2 py-2 align-middle text-muted-foreground sm:px-4 sm:py-3">
                                {battle.date}
                              </td>
                            ) : null}
                          </tr>
                          {isExpanded ? (
                            <tr>
                              <td
                                colSpan={isMobile ? 3 : 4}
                                className="relative z-0 border-b border-border/40 bg-background/20 px-2 pb-3 sm:px-4 sm:pb-4"
                              >
                                <div className="relative z-0 pt-3">
                                  {isMobile ? (
                                    <BattleHistoryMobileDetail
                                      battle={battle}
                                      selectedWarbandId={selectedWarbandId}
                                      onSelectedWarbandChange={(value) =>
                                        setSelectedWarbandByBattleId((prev) => ({
                                          ...prev,
                                          [battle.id]: value,
                                        }))
                                      }
                                    />
                                  ) : (
                                    <BattleHistoryDetailTable participants={battle.participants} />
                                  )}
                                  {renderBattleActions ? (
                                    <div className="flex justify-end pt-2">
                                      {renderBattleActions(battle)}
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
