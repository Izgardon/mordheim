import { Fragment } from "react";

// routing
import { Link } from "react-router-dom";

// icons
import { ChevronDown, Eye, Shield, Skull, Swords, Trophy, User, type LucideIcon } from "lucide-react";

// components
import { Button } from "@components/button";
import { RosterSkeleton } from "@components/card-skeleton";

// components
import UnitsTable from "./UnitsTable";

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

type WarbandRecordMetricProps = {
  icon: LucideIcon;
  label: string;
  value: number;
  toneClassName?: string;
};

function normalizeRecordValue(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function WarbandRecordMetric({
  icon: Icon,
  label,
  value,
  toneClassName = "text-foreground",
}: WarbandRecordMetricProps) {
  return (
    <div
      role="listitem"
      aria-label={`${label}: ${value}`}
      className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-card/70 px-2 py-2 text-center shadow-sm sm:justify-start sm:px-3"
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${toneClassName}`} aria-hidden="true" />
      <span className={`text-sm font-semibold ${toneClassName}`}>{value}</span>
      <span className="sr-only sm:not-sr-only sm:text-[0.65rem] sm:font-semibold sm:uppercase sm:tracking-[0.18em] sm:text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function WarbandRecordStrip({ warband }: { warband: CampaignPlayer["warband"] }) {
  const wins = normalizeRecordValue(warband?.wins);
  const losses = normalizeRecordValue(warband?.losses);
  const battles = wins + losses;

  return (
    <div
      role="list"
      aria-label="Warband record"
      className="grid grid-cols-3 gap-2 rounded-2xl border border-border/50 bg-background/40 p-2"
    >
      <WarbandRecordMetric icon={Swords} label="Battles" value={battles} />
      <WarbandRecordMetric icon={Trophy} label="Wins" value={wins} toneClassName="text-[#d4af37]" />
      <WarbandRecordMetric icon={Skull} label="Losses" value={losses} toneClassName="text-rose-300" />
    </div>
  );
}

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
                    const warband = player.warband;
                    const isExpanded = expandedPlayers.includes(player.id);
                    const warbandId = warband?.id ?? null;
                    const snapshotHeroes = warbandId ? heroSnapshots[warbandId] : undefined;
                    const isSnapshotLoading = warbandId ? snapshotLoading[warbandId] : false;
                    const snapshotError = warbandId ? snapshotErrors[warbandId] : "";

                    return (
                      <Fragment key={player.id}>
                        <tr
                          className={[
                            "cursor-pointer border-b border-border/40 transition-colors",
                            index % 2 === 0 ? "table-row-even" : "table-row-odd",
                            isExpanded ? "table-row-active" : "table-row-hover",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => onTogglePlayer(player)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onTogglePlayer(player);
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
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              aria-hidden="true"
                            />
                          </td>
                          <td className="px-2 py-2 align-middle sm:px-4 sm:py-3">
                            <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
                              <div className="min-w-0">
                                <p className="flex items-center gap-1.5 font-semibold text-foreground sm:gap-2">
                                  <User className="hidden h-3.5 w-3.5 text-muted-foreground sm:inline-block" />
                                  <span className="block min-w-0 truncate sm:max-w-none">
                                    {player.name}
                                  </span>
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2 align-middle text-sm text-muted-foreground sm:px-4 sm:py-3">
                            <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                              <Shield className="hidden h-3.5 w-3.5 text-muted-foreground sm:inline-block" />
                              <span className="block min-w-0 truncate sm:max-w-none">
                                {warband?.name || "Unassigned"}
                              </span>
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 align-middle text-sm text-muted-foreground sm:table-cell">
                            <span className="inline-flex items-center gap-2">
                              <Swords className="h-3.5 w-3.5 text-muted-foreground" />
                              {warband?.faction || "-"}
                            </span>
                          </td>
                          <td className="px-2 py-2 align-middle text-right whitespace-nowrap sm:px-4 sm:py-3">
                            {warband ? (
                              <Button
                                asChild
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 sm:h-9 sm:w-9"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Link to={`/campaigns/${campaignId}/warbands/${warband.id}`}>
                                  <Eye className="h-4 w-4" aria-hidden="true" />
                                  <span className="sr-only">View warband</span>
                                </Link>
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-9 w-9"
                                disabled
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">View warband</span>
                              </Button>
                            )}
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr>
                            <td colSpan={5} className="relative z-0 border-b border-border/40 bg-background/20 px-2 pb-3 sm:px-4 sm:pb-4">
                              {!warbandId ? (
                                <p className="pt-3 text-sm text-muted-foreground">
                                  No warband assigned yet.
                                </p>
                              ) : (
                                <div className="relative z-0 space-y-3 pt-3">
                                  <WarbandRecordStrip warband={warband} />
                                  {isSnapshotLoading ? (
                                    <p className="text-sm text-muted-foreground">
                                      Loading warband...
                                    </p>
                                  ) : snapshotError ? (
                                    <p className="text-sm text-red-600">{snapshotError}</p>
                                  ) : snapshotHeroes && snapshotHeroes.length > 0 ? (
                                    <div className="max-h-64 overflow-y-auto pr-1">
                                      <UnitsTable units={snapshotHeroes} />
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">
                                      No units logged yet.
                                    </p>
                                  )}
                                </div>
                              )}
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
