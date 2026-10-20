// icons
import { ChevronDown } from "lucide-react";

// components
import { RosterSkeleton } from "@components/card-skeleton";
import RosterRow from "./RosterRow";

// types
import type { CampaignPlayer } from "../../types/campaign-types";
import type { RosterUnit } from "../../hooks/useCampaignOverview";

type RosterTableProps = {
  campaignId: number;
  playerCount: number;
  maxPlayers: number;
  isMobile: boolean;
  mobileExpanded: boolean;
  onToggleMobileExpanded: () => void;
  isLoading: boolean;
  error: string;
  players: CampaignPlayer[];
  expandedPlayers: number[];
  onTogglePlayer: (player: CampaignPlayer) => void;
  heroSnapshots: Record<number, RosterUnit[]>;
  snapshotLoading: Record<number, boolean>;
  snapshotErrors: Record<number, string>;
};

export default function RosterTable({
  campaignId,
  playerCount,
  maxPlayers,
  isMobile,
  mobileExpanded,
  onToggleMobileExpanded,
  isLoading,
  error,
  players,
  expandedPlayers,
  onTogglePlayer,
  heroSnapshots,
  snapshotLoading,
  snapshotErrors,
}: RosterTableProps) {
  const rosterLabel = `Roster (${playerCount} / ${maxPlayers})`;
  return (
    <section className="w-full space-y-3">
      {isMobile ? (
        <button
          type="button"
          onClick={onToggleMobileExpanded}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={mobileExpanded}
        >
          <h2 className="text-base font-semibold text-foreground">{rosterLabel}</h2>
          <ChevronDown
            className={`h-5 w-5 shrink-0 transition-transform ${
              mobileExpanded ? "rotate-0 text-foreground" : "-rotate-90 text-muted-foreground"
            }`}
            aria-hidden="true"
          />
        </button>
      ) : (
        <h2 className="text-base font-semibold text-foreground">{rosterLabel}</h2>
      )}
      {!isMobile || mobileExpanded ? (
        <>
          {isLoading ? (
            <RosterSkeleton rows={5} />
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : players.length === 0 ? (
            <p className="text-sm text-muted-foreground">No names logged yet.</p>
          ) : (
            <div className="table-shell overflow-hidden rounded-2xl">
              <div className="scrollbar-hidden-mobile max-h-[500px] overflow-x-auto overflow-y-auto">
                <table
                  className={`w-full text-left text-sm text-foreground ${
                    isMobile ? "table-fixed" : ""
                  }`}
                >
                  <thead>
                    <tr className="table-head-surface border-b border-border/40 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                      <th className="w-8 px-2 py-2 text-left font-semibold sm:w-10 sm:px-4 sm:py-3">
                        <span className="sr-only">Expand</span>
                      </th>
                      <th className="w-[42%] px-2 py-2 text-left font-semibold sm:w-auto sm:px-4 sm:py-3">
                        Player
                      </th>
                      <th className="px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">Warband</th>
                      <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">
                        Faction
                      </th>
                      <th className="w-12 px-2 py-2 text-right font-semibold sm:w-16 sm:px-4 sm:py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, index) => {
                      const warbandId = player.warband?.id ?? null;
                      return (
                        <RosterRow
                          key={player.id}
                          campaignId={campaignId}
                          player={player}
                          index={index}
                          isExpanded={expandedPlayers.includes(player.id)}
                          onToggle={() => onTogglePlayer(player)}
                          units={warbandId ? heroSnapshots[warbandId] : undefined}
                          isUnitsLoading={warbandId ? Boolean(snapshotLoading[warbandId]) : false}
                          unitsError={warbandId ? (snapshotErrors[warbandId] ?? "") : ""}
                        />
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
