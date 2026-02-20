import { Fragment, useState } from "react";
import type { CSSProperties } from "react";

// routing
import { Link, useOutletContext, useParams } from "react-router-dom";
import { useMediaQuery } from "@/lib/use-media-query";

// icons
import { ChevronDown, Eye, Shield, Swords, User } from "lucide-react";

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
import type { RosterUnit } from "../hooks/useCampaignOverview";
import type { TradeOffer, TradeRequest } from "@/features/warbands/types/trade-request-types";

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
    tradeRequests,
    tradeError,
    isTradesLoading,
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
            ? "space-y-4 p-2 rounded-none border-x-0"
            : "space-y-4 p-3 sm:space-y-6 sm:p-6"
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
        <div className="grid gap-4 min-[1200px]:grid-cols-2">
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
          <TradeOverviewTable
            isLoading={isTradesLoading}
            error={tradeError}
            trades={tradeRequests}
          />
        </div>
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
  heroSnapshots: Record<number, RosterUnit[]>;
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
                    <th className="w-10 px-4 py-3 text-left font-semibold">
                      <span className="sr-only">Expand</span>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">Player</th>
                    <th className="px-4 py-3 text-left font-semibold">Warband</th>
                    <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Faction</th>
                    <th className="w-16 px-4 py-3 text-right font-semibold">
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
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
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
                                  <WarbandHeroesTable units={snapshotHeroes} />
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

type TradeOverviewTableProps = {
  isLoading: boolean;
  error: string;
  trades: TradeRequest[];
};

const formatTradeDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "-";
  return date.toLocaleDateString();
};

const getOfferValue = (offer?: TradeOffer) => {
  const gold = Math.max(0, Number(offer?.gold ?? 0));
  const items = Array.isArray(offer?.items) ? offer?.items ?? [] : [];
  const itemTotal = items.reduce((sum, item) => {
    const quantity = Math.max(0, Number(item.quantity ?? 0));
    const cost = Math.max(0, Number(item.cost ?? 0));
    return sum + quantity * cost;
  }, 0);
  return gold + itemTotal;
};

const buildOfferLines = (offer?: TradeOffer) => {
  const lines: string[] = [];
  const gold = Math.max(0, Number(offer?.gold ?? 0));
  if (gold) {
    lines.push(`${gold} gc`);
  }
  const items = Array.isArray(offer?.items) ? offer?.items ?? [] : [];
  items.forEach((item) => {
    const quantity = Math.max(0, Number(item.quantity ?? 0));
    if (!quantity) {
      return;
    }
    const cost = Math.max(0, Number(item.cost ?? 0));
    const value = quantity * cost;
    const suffix = cost ? ` (${value} gc)` : "";
    lines.push(`${item.name} x${quantity}${suffix}`);
  });
  return lines;
};

function TradeOverviewTable({ isLoading, error, trades }: TradeOverviewTableProps) {
  const [expandedTradeIds, setExpandedTradeIds] = useState<string[]>([]);

  const toggleTrade = (tradeId: string) => {
    setExpandedTradeIds((prev) =>
      prev.includes(tradeId) ? prev.filter((id) => id !== tradeId) : [...prev, tradeId]
    );
  };

  return (
    <Card className="w-full max-w-none">
      <CardHeader className="px-2 sm:px-6">
        <CardTitle>Trades</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pt-0 sm:px-6">
        {isLoading ? (
          <RosterSkeleton rows={4} />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : trades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed trades yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-[0_18px_32px_rgba(5,20,24,0.35)]">
            <div className="scrollbar-hidden-mobile max-h-[60vh] overflow-x-auto overflow-y-auto">
              <table className="w-full text-left text-sm text-foreground">
                <thead>
                  <tr className="border-b border-border/40 bg-black text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                    <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Trade</th>
                    <th className="px-4 py-3 text-left font-semibold">Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade, index) => {
                    const fromName = trade.from_warband?.name || "Unknown warband";
                    const toName = trade.to_warband?.name || "Unknown warband";
                    const totalValue = getOfferValue(trade.from_offer) + getOfferValue(trade.to_offer);
                    const isExpanded = expandedTradeIds.includes(trade.id);
                    const fromLines = buildOfferLines(trade.from_offer);
                    const toLines = buildOfferLines(trade.to_offer);
                    const fromTrader = trade.from_offer?.trader_name?.trim();
                    const toTrader = trade.to_offer?.trader_name?.trim();
                    const fromHeader = fromTrader
                      ? `${fromName} sent ${fromTrader} to trade:`
                      : `${fromName} traded:`;
                    const toHeader = toTrader
                      ? `${toName} sent ${toTrader} to trade:`
                      : `${toName} traded:`;
                    return (
                      <Fragment key={trade.id}>
                        <tr
                          className="cursor-pointer border-b border-border/40 transition-[filter] hover:brightness-110"
                          style={{
                            ...OVERVIEW_ROW_BG_STYLE,
                            backgroundImage:
                              index % 2 === 0
                                ? `linear-gradient(rgba(255,255,255,0.02), rgba(255,255,255,0.02)), url(${basicBar})`
                                : `linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.05)), url(${basicBar})`,
                          }}
                          onClick={() => toggleTrade(trade.id)}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleTrade(trade.id);
                            }
                          }}
                        >
                          <td className="hidden px-4 py-3 align-middle text-xs text-muted-foreground sm:table-cell">
                            {formatTradeDate(trade.responded_at ?? trade.created_at)}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-2">
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
                              <p className="truncate text-foreground">
                                <span className="font-bold text-ring">{fromName}</span> traded with{" "}
                                <span className="font-bold text-ring">{toName}</span>
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                            {totalValue} gc
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr>
                            <td colSpan={3} className="border-b border-border/40 bg-background/20 px-4 pb-4">
                              <div className="grid gap-4 pt-3 sm:grid-cols-2">
                                <div className="space-y-2 rounded-lg border border-border/60 bg-black/30 p-3">
                                  <p className="text-xs font-semibold text-muted-foreground">
                                    {fromHeader}
                                  </p>
                                  {fromLines.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No items or gold.</p>
                                  ) : (
                                    <ul className="space-y-1 text-sm text-foreground">
                                      {fromLines.map((line) => (
                                        <li key={line}>{line}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <div className="space-y-2 rounded-lg border border-border/60 bg-black/30 p-3">
                                  <p className="text-xs font-semibold text-muted-foreground">
                                    {toHeader}
                                  </p>
                                  {toLines.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No items or gold.</p>
                                  ) : (
                                    <ul className="space-y-1 text-sm text-foreground">
                                      {toLines.map((line) => (
                                        <li key={line}>{line}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
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
      </CardContent>
    </Card>
  );
}
