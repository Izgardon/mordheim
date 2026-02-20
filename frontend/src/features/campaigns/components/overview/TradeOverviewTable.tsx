import { Fragment, useState } from "react";
import type { CSSProperties } from "react";

// icons
import { ChevronDown } from "lucide-react";

// components
import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
import { RosterSkeleton } from "@components/card-skeleton";
import basicBar from "@/assets/containers/basic_bar.webp";

// types
import type { TradeOffer, TradeRequest } from "@/features/warbands/types/trade-request-types";

type TradeOverviewTableProps = {
  isLoading: boolean;
  error: string;
  trades: TradeRequest[];
};

const OVERVIEW_ROW_BG_STYLE: CSSProperties = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
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

export default function TradeOverviewTable({ isLoading, error, trades }: TradeOverviewTableProps) {
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
                    <th className="w-10 px-4 py-3 text-left font-semibold">
                      <span className="sr-only">Expand</span>
                    </th>
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
                          <td className="hidden px-4 py-3 align-middle text-xs text-muted-foreground sm:table-cell">
                            {formatTradeDate(trade.responded_at ?? trade.created_at)}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <p className="truncate text-foreground">
                              <span className="font-bold text-ring">{fromName}</span> traded with{" "}
                              <span className="font-bold text-ring">{toName}</span>
                            </p>
                          </td>
                          <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                            {totalValue} gc
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr>
                            <td colSpan={4} className="border-b border-border/40 bg-background/20 px-4 pb-4">
                              <div className="max-h-64 overflow-y-auto pt-3">
                                <div className="grid gap-4 sm:grid-cols-2">
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
