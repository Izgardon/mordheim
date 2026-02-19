import { Fragment } from "react";
import type { CSSProperties } from "react";

// routing
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useMediaQuery } from "@/lib/use-media-query";

// icons
import { ChevronDown, Shield, Swords, User } from "lucide-react";

// components
import { Button } from "@components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
import { CardBackground } from "@components/card-background";
import { RosterSkeleton } from "@components/card-skeleton";
import { ConfirmDialog } from "@components/confirm-dialog";
import { PageHeader } from "@components/page-header";
import basicBar from "@/assets/containers/basic_bar.webp";

// components
import WarbandHeroesTable from "../components/overview/WarbandHeroesTable";

// hooks
import { useCampaignOverview } from "../hooks/useCampaignOverview";

// types
import type { CampaignPlayer, CampaignSummary } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";
import type { WarbandHero } from "../../warbands/types/warband-types";

const defaultTypeLabel = "Standard";
const OVERVIEW_ROW_BG_STYLE: CSSProperties = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
};

export default function CampaignOverview() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");

  const campaignId = Number(id);

  const {
    players,
    isLoading,
    error,
    expandedPlayers,
    heroSnapshots,
    snapshotLoading,
    snapshotErrors,
    togglePlayer,
    typeLabel,
    canStartCampaign,
    isUnderway,
    isStartOpen,
    setIsStartOpen,
    isStarting,
    startError,
    handleStartCampaign,
  } = useCampaignOverview({ campaignId, campaign });

  if (!campaign) {
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;
  }

  return (
    <div className="min-h-0 space-y-6">
      <OverviewHeader campaign={campaign} typeLabel={typeLabel} />
      <CardBackground
        disableBackground={isMobile}
        className={
          isMobile
            ? "space-y-4 p-3 rounded-none border-x-0"
            : "space-y-4 p-3 sm:space-y-6 sm:p-6 sm:-mx-[5%] sm:w-[calc(100%+10%)]"
        }
      >
        {canStartCampaign && !isUnderway ? (
          <div className="flex justify-center px-2 sm:px-0">
            <Button variant="secondary" onClick={() => setIsStartOpen(true)}>
              Start campaign
            </Button>
            <ConfirmDialog
              open={isStartOpen}
              onOpenChange={(nextOpen) => {
                setIsStartOpen(nextOpen);
                if (!nextOpen) {
                  // startError is managed by hook
                }
              }}
              description={
                <div className="space-y-2">
                  <p>Start the campaign now? This will lock in the roster.</p>
                  {startError ? <p className="text-sm text-red-600">{startError}</p> : null}
                </div>
              }
              confirmText={isStarting ? "Starting..." : "Confirm start"}
              confirmVariant="secondary"
              confirmDisabled={isStarting}
              isConfirming={isStarting}
              onConfirm={handleStartCampaign}
              onCancel={() => setIsStartOpen(false)}
            />
          </div>
        ) : null}
        <RosterTable
          campaignId={campaign.id}
          playerCount={campaign.player_count}
          maxPlayers={campaign.max_players}
          isLoading={isLoading}
          error={error}
          players={players}
          expandedPlayers={expandedPlayers}
          onTogglePlayer={togglePlayer}
          heroSnapshots={heroSnapshots}
          snapshotLoading={snapshotLoading}
          snapshotErrors={snapshotErrors}
        />
      </CardBackground>
    </div>
  );
}

type OverviewHeaderProps = {
  campaign: CampaignSummary;
  typeLabel: string;
};

function OverviewHeader({ campaign, typeLabel }: OverviewHeaderProps) {
  return (
    <PageHeader
      title={campaign.name}
      subtitle={typeLabel || defaultTypeLabel}
    />
  );
}

type PlayersCardProps = {
  campaignId: number;
  playerCount: number;
  maxPlayers: number;
  isLoading: boolean;
  error: string;
  players: CampaignPlayer[];
  expandedPlayers: number[];
  onTogglePlayer: (player: CampaignPlayer) => void;
  heroSnapshots: Record<number, WarbandHero[]>;
  snapshotLoading: Record<number, boolean>;
  snapshotErrors: Record<number, string>;
};

function RosterTable({
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
}: PlayersCardProps) {
  const rosterLabel = `Roster (${playerCount} / ${maxPlayers})`;
  return (
    <Card className="w-full max-w-none">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>{rosterLabel}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-0 sm:px-6">
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
                    <th className="w-10 px-4 py-3 text-left font-semibold">
                      <span className="sr-only">Expand</span>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">Player</th>
                    <th className="px-4 py-3 text-left font-semibold">Warband</th>
                    <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Faction</th>
                    <th className="w-24 px-4 py-3 text-right font-semibold">Actions</th>
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
                        <td className="px-4 py-3 align-middle">
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
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="flex items-center gap-2 font-semibold text-foreground">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                {player.name}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                            {warband?.name || "Unassigned"}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 align-middle text-sm text-muted-foreground sm:table-cell">
                          <span className="inline-flex items-center gap-2">
                            <Swords className="h-3.5 w-3.5 text-muted-foreground" />
                            {warband?.faction || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                          {warband ? (
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Link to={`/campaigns/${campaignId}/warbands/${warband.id}`}>
                                View
                              </Link>
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled onClick={(event) => event.stopPropagation()}>
                              View
                            </Button>
                          )}
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={5} className="border-b border-border/40 bg-background/20 px-4 pb-4">
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
                                <div className="mt-3">
                                  <WarbandHeroesTable heroes={snapshotHeroes} />
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
