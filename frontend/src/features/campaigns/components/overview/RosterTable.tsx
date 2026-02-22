import { Fragment } from "react";
import type { CSSProperties } from "react";

// routing
import { Link } from "react-router-dom";

// icons
import { ChevronDown, Eye, Shield, Swords, User } from "lucide-react";

// components
import { Button } from "@components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
import { RosterSkeleton } from "@components/card-skeleton";
import basicBar from "@/assets/containers/basic_bar.webp";

// components
import UnitsTable from "./UnitsTable";

// types
import type { CampaignPlayer } from "../../types/campaign-types";
import type { RosterUnit } from "../../hooks/useCampaignOverview";

type RosterTableProps = {
  campaignId: number;
  playerCount: number;
  maxPlayers: number;
  isLoading: boolean;
  error: string;
  players: CampaignPlayer[];
  expandedPlayers: number[];
  onTogglePlayer: (player: CampaignPlayer) => void;
  heroSnapshots: Record<number, RosterUnit[]>;
  snapshotLoading: Record<number, boolean>;
  snapshotErrors: Record<number, string>;
};

const OVERVIEW_ROW_BG_STYLE: CSSProperties = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
};

export default function RosterTable({
  campaignId,
  playerCount,
  maxPlayers,
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
    <Card className="w-full max-w-none">
      <CardHeader className="px-2 sm:px-6">
        <CardTitle>{rosterLabel}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pt-0 sm:px-6">
        {isLoading ? (
          <RosterSkeleton rows={5} />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No names logged yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-[0_18px_32px_rgba(5,20,24,0.35)]">
            <div className="scrollbar-hidden-mobile max-h-[60vh] overflow-x-auto overflow-y-auto">
              <table className="w-full text-left text-sm text-foreground">
                <thead>
                  <tr className="border-b border-border/40 bg-black text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                    <th className="w-8 px-2 py-2 text-left font-semibold sm:w-10 sm:px-4 sm:py-3">
                      <span className="sr-only">Expand</span>
                    </th>
                    <th className="px-2 py-2 text-left font-semibold sm:px-4 sm:py-3">Player</th>
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
                            "cursor-pointer border-b border-border/40 transition-[filter]",
                            isExpanded ? "brightness-110" : "hover:brightness-110",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={{
                            ...OVERVIEW_ROW_BG_STYLE,
                            backgroundImage:
                              index % 2 === 0
                                ? `linear-gradient(rgba(255,255,255,0.02), rgba(255,255,255,0.02)), url(${basicBar})`
                                : `linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.05)), url(${basicBar})`,
                          }}
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
                              <div>
                                <p className="flex items-center gap-1.5 font-semibold text-foreground sm:gap-2">
                                  <User className="hidden h-3.5 w-3.5 text-muted-foreground sm:inline-block" />
                                  <span className="block max-w-[140px] truncate sm:max-w-none">
                                    {player.name}
                                  </span>
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2 align-middle text-sm text-muted-foreground sm:px-4 sm:py-3">
                            <span className="inline-flex min-w-0 items-center gap-1.5 sm:gap-2">
                              <Shield className="hidden h-3.5 w-3.5 text-muted-foreground sm:inline-block" />
                              <span className="block max-w-[150px] truncate sm:max-w-none">
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
                            <td colSpan={5} className="border-b border-border/40 bg-background/20 px-2 pb-3 sm:px-4 sm:pb-4">
                              {!warbandId ? (
                                <p className="pt-3 text-sm text-muted-foreground">
                                  No warband assigned yet.
                                </p>
                              ) : isSnapshotLoading ? (
                                <p className="pt-3 text-sm text-muted-foreground">
                                  Loading warband...
                                </p>
                              ) : snapshotError ? (
                                <p className="pt-3 text-sm text-red-600">{snapshotError}</p>
                              ) : snapshotHeroes && snapshotHeroes.length > 0 ? (
                                <div className="pt-3">
                                  <div className="mt-3 max-h-64 overflow-y-auto pr-1">
                                    <UnitsTable units={snapshotHeroes} />
                                  </div>
                                </div>
                              ) : (
                                <p className="pt-3 text-sm text-muted-foreground">
                                  No units logged yet.
                                </p>
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
      </CardContent>
    </Card>
  );
}
