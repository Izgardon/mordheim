import { Fragment, useEffect, useMemo, useState } from "react";

// routing
import { Link, useOutletContext, useParams } from "react-router-dom";

// icons
import { ChevronRight, Shield, Swords, Trophy, User } from "lucide-react";

// components
import { Button } from "@components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/dialog";

// api
import { listCampaignPlayers, updateCampaign } from "../api/campaigns-api";
import { listWarbandHeroes } from "../../warbands/api/warbands-api";

// types
import type { CampaignPlayer, CampaignSummary } from "../types/campaign-types";
import type { CampaignLayoutContext } from "./CampaignLayout";
import type { WarbandHero } from "../../warbands/types/warband-types";

const defaultTypeLabel = "Standard";

export default function CampaignOverview() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const [players, setPlayers] = useState<CampaignPlayer[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPlayers, setExpandedPlayers] = useState<number[]>([]);
  const [heroSnapshots, setHeroSnapshots] = useState<Record<number, WarbandHero[]>>({});
  const [snapshotLoading, setSnapshotLoading] = useState<Record<number, boolean>>({});
  const [snapshotErrors, setSnapshotErrors] = useState<Record<number, string>>({});
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [isUnderway, setIsUnderway] = useState(campaign?.in_progress ?? false);

  const typeLabel = useMemo(() => {
    if (!campaign?.campaign_type) {
      return defaultTypeLabel;
    }
    return campaign.campaign_type.replace(/_/g, " ");
  }, [campaign?.campaign_type]);

  useEffect(() => {
    if (campaign) {
      setIsUnderway(campaign.in_progress);
    }
  }, [campaign]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const campaignId = Number(id);
    if (Number.isNaN(campaignId)) {
      setError("Invalid campaign id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    listCampaignPlayers(campaignId)
      .then((playerData) => setPlayers(playerData))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load players");
        } else {
          setError("Unable to load players");
        }
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  const canStartCampaign = campaign?.role === "owner" || campaign?.role === "admin";

  const handleStartCampaign = async () => {
    if (!campaign) {
      return;
    }

    setIsStarting(true);
    setStartError("");

    try {
      await updateCampaign(campaign.id, { in_progress: true });
      setIsUnderway(true);
      setIsStartOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setStartError(errorResponse.message || "Unable to start campaign");
      } else {
        setStartError("Unable to start campaign");
      }
    } finally {
      setIsStarting(false);
    }
  };

  if (!campaign) {
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;
  }

  const togglePlayer = (player: CampaignPlayer) => {
    setExpandedPlayers((prev) => {
      const isExpanded = prev.includes(player.id);
      if (isExpanded) {
        return prev.filter((entry) => entry !== player.id);
      }
      return [...prev, player.id];
    });

    const warbandId = player.warband?.id;
    if (!warbandId) {
      return;
    }

    if (heroSnapshots[warbandId] || snapshotLoading[warbandId]) {
      return;
    }

    setSnapshotLoading((prev) => ({ ...prev, [warbandId]: true }));
    setSnapshotErrors((prev) => ({ ...prev, [warbandId]: "" }));

    listWarbandHeroes(warbandId)
      .then((heroes) => {
        setHeroSnapshots((prev) => ({ ...prev, [warbandId]: heroes }));
      })
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setSnapshotErrors((prev) => ({
            ...prev,
            [warbandId]: errorResponse.message || "Unable to load warband heroes",
          }));
        } else {
          setSnapshotErrors((prev) => ({ ...prev, [warbandId]: "Unable to load warband heroes" }));
        }
      })
      .finally(() => {
        setSnapshotLoading((prev) => ({ ...prev, [warbandId]: false }));
      });
  };

  return (
    <div className="space-y-6">
      <OverviewHeader campaign={campaign} typeLabel={typeLabel} />
      {canStartCampaign && !isUnderway ? (
        <div className="flex justify-center">
          <Dialog
            open={isStartOpen}
            onOpenChange={(nextOpen) => {
              setIsStartOpen(nextOpen);
              if (!nextOpen) {
                setStartError("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="secondary">Start campaign</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start campaign</DialogTitle>
                <DialogDescription>
                  This locks in the roster and begins the campaign timeline.
                </DialogDescription>
              </DialogHeader>
              {startError ? <p className="text-sm text-red-600">{startError}</p> : null}
              <DialogFooter>
                <Button onClick={handleStartCampaign} disabled={isStarting}>
                  {isStarting ? "Starting..." : "Confirm start"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
      <RosterTable
        campaignId={campaign.id}
        isLoading={isLoading}
        error={error}
        players={players}
        expandedPlayers={expandedPlayers}
        onTogglePlayer={togglePlayer}
        heroSnapshots={heroSnapshots}
        snapshotLoading={snapshotLoading}
        snapshotErrors={snapshotErrors}
      />
    </div>
  );
}

type OverviewHeaderProps = {
  campaign: CampaignSummary;
  typeLabel: string;
};

function OverviewHeader({ campaign, typeLabel }: OverviewHeaderProps) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
        {typeLabel}
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">{campaign.name}</h1>
      <p className="mt-2 text-muted-foreground">
        {campaign.player_count} / {campaign.max_players} players
      </p>
    </div>
  );
}

type PlayersCardProps = {
  campaignId: number;
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
  isLoading,
  error,
  players,
  expandedPlayers,
  onTogglePlayer,
  heroSnapshots,
  snapshotLoading,
  snapshotErrors,
}: PlayersCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roster</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Calling the roster...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No names logged yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-[0_18px_32px_rgba(5,20,24,0.35)]">
            <table className="w-full text-left text-sm text-foreground">
              <tbody>
                {players.map((player) => {
                  const warband = player.warband;
                  const isExpanded = expandedPlayers.includes(player.id);
                  const wins = warband?.wins ?? 0;
                  const losses = warband?.losses ?? 0;
                  const warbandId = warband?.id ?? null;
                  const snapshotHeroes = warbandId ? heroSnapshots[warbandId] : undefined;
                  const isSnapshotLoading = warbandId ? snapshotLoading[warbandId] : false;
                  const snapshotError = warbandId ? snapshotErrors[warbandId] : "";

                  return (
                    <Fragment key={player.id}>
                      <tr
                        className={[
                          "cursor-pointer border-b border-border/40 bg-background/30 transition",
                          isExpanded ? "bg-muted/20" : "hover:bg-muted/10",
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
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            <span
                              className={[
                                "inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 text-xs transition-transform",
                                isExpanded ? "rotate-90 bg-muted/30" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </span>
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
                        <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <Swords className="h-3.5 w-3.5 text-muted-foreground" />
                            {warband?.faction || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
                            {wins} wins {losses} losses
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
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
                                Loading warband snapshot...
                              </p>
                            ) : snapshotError ? (
                              <p className="pt-3 text-sm text-red-600">{snapshotError}</p>
                            ) : snapshotHeroes && snapshotHeroes.length > 0 ? (
                              <div className="pt-3">
                                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                  Warband snapshot
                                </p>
                                <div className="mt-3 overflow-x-auto rounded-xl border border-border/60 bg-card/70">
                                  <table className="min-w-full text-xs text-muted-foreground">
                                    <thead>
                                      <tr className="border-b border-border/40 bg-background/40 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                                        <th className="px-3 py-2 text-left text-foreground">Name</th>
                                        <th className="px-3 py-2 text-left">Type</th>
                                        <th className="px-3 py-2 text-left">M</th>
                                        <th className="px-3 py-2 text-left">WS</th>
                                        <th className="px-3 py-2 text-left">BS</th>
                                        <th className="px-3 py-2 text-left">S</th>
                                        <th className="px-3 py-2 text-left">T</th>
                                        <th className="px-3 py-2 text-left">W</th>
                                        <th className="px-3 py-2 text-left">I</th>
                                        <th className="px-3 py-2 text-left">A</th>
                                        <th className="px-3 py-2 text-left">Ld</th>
                                        <th className="px-3 py-2 text-left">AS</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {snapshotHeroes.map((hero) => (
                                        <tr key={hero.id} className="border-b border-border/40 last:border-b-0">
                                          <td className="px-3 py-2 text-sm font-semibold text-foreground">
                                            {hero.name || "Unnamed"}
                                          </td>
                                          <td className="px-3 py-2 text-xs uppercase tracking-[0.2em]">
                                            {hero.unit_type || "Hero"}
                                          </td>
                                          <td className="px-3 py-2">{hero.movement ?? 0}</td>
                                          <td className="px-3 py-2">{hero.weapon_skill ?? 0}</td>
                                          <td className="px-3 py-2">{hero.ballistic_skill ?? 0}</td>
                                          <td className="px-3 py-2">{hero.strength ?? 0}</td>
                                          <td className="px-3 py-2">{hero.toughness ?? 0}</td>
                                          <td className="px-3 py-2">{hero.wounds ?? 0}</td>
                                          <td className="px-3 py-2">{hero.initiative ?? 0}</td>
                                          <td className="px-3 py-2">{hero.attacks ?? 0}</td>
                                          <td className="px-3 py-2">{hero.leadership ?? 0}</td>
                                          <td className="px-3 py-2">{hero.armour_save || "-"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <p className="pt-3 text-sm text-muted-foreground">
                                No heroes logged yet.
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
        )}
      </CardContent>
    </Card>
  );
}





