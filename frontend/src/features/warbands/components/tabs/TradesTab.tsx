import { useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@components/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import useTradesTab from "../../hooks/warband/useTradesTab";
import {
  formatTradeAction,
  formatTradeDate,
  getSignedTradePrice,
} from "../../utils/warband-utils";

import type {
  Warband,
  WarbandTrade,
  WarbandTradeChild,
} from "../../types/warband-types";

const TRADE_ACTIONS = [
  "Buy",
  "Sell",
  "Upkeep",
  "Exploration",
  "Reward",
  "Recruit",
  "Hire",
] as const;

const DESCRIPTION_PLACEHOLDERS: Record<(typeof TRADE_ACTIONS)[number], string> = {
  Buy: "What was bought?",
  Sell: "What was sold?",
  Upkeep: "What upkeep was paid?",
  Exploration: "What was found or claimed?",
  Reward: "What reward was gained?",
  Recruit: "Who was recruited?",
  Hire: "Who was hired?",
};

type TradesTabProps = {
  warband: Warband;
  canEdit?: boolean;
  isMobile?: boolean;
  onTradeCreated?: (trade: WarbandTrade) => void;
};

const formatSignedPrice = (
  trade: Pick<WarbandTrade | WarbandTradeChild, "action" | "price">
) => {
  const signed = getSignedTradePrice(trade);
  return signed === 0 ? "-" : `${signed > 0 ? "+" : ""}${signed} gc`;
};

const getActionBadgeClass = (action: string) => {
  const isExpense = getSignedTradePrice({ action, price: 1 }) < 0;
  return isExpense
    ? "rounded border border-red-700/70 bg-red-900/40 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-red-200"
    : "rounded border border-emerald-700/70 bg-emerald-900/40 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-emerald-200";
};

const formatTradeDateShort = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  });
};

export default function TradesTab({
  warband,
  canEdit = false,
  isMobile = false,
  onTradeCreated,
}: TradesTabProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const toggleGroup = useCallback((id: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const {
    trades,
    isLoading,
    error,
    isFormOpen,
    handleOpenForm,
    handleCloseForm,
    formAction,
    setFormAction,
    formDescription,
    setFormDescription,
    formPrice,
    setFormPrice,
    formNotes,
    setFormNotes,
    isSubmitting,
    submitError,
    handleSubmit,
  } = useTradesTab({ warbandId: warband.id, onTradeCreated });

  const descriptionPlaceholder =
    DESCRIPTION_PLACEHOLDERS[formAction] ?? "Describe this ledger entry";

  return (
    <div className="surface-panel-strong relative rounded-lg space-y-4 p-4 sm:p-7">
      {canEdit && !isFormOpen ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleOpenForm}>
            Add Trade Entry
          </Button>
        </div>
      ) : null}

      {isFormOpen ? (
        <div className="space-y-3 border border-border/60 bg-background/80 p-4">
          <div
            className={
              isMobile
                ? "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3"
                : "grid gap-3 sm:grid-cols-2"
            }
          >
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Action
              </label>
              <Select value={formAction} onValueChange={setFormAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  {TRADE_ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Gold coins
              </label>
              <NumberInput
                min={0}
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="0"
                compact={isMobile}
                mobileButtonVariant={isMobile ? "solid" : "image"}
                containerClassName={isMobile ? "w-[7.5rem]" : undefined}
                className={isMobile ? "w-12" : undefined}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Description
            </label>
            <Input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder={descriptionPlaceholder}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Notes (optional)
            </label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
              className="min-h-[80px] w-full border border-border/60 bg-background/80 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
            />
          </div>
          {submitError ? (
            <p className="text-sm text-red-600">{submitError}</p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={handleCloseForm}
              disabled={isSubmitting}
              size="sm"
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} size="sm">
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border/60 bg-black/20">
        {isLoading ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">Loading trades...</p>
        ) : error ? (
          <p className="px-3 py-3 text-sm text-red-600">{error}</p>
        ) : trades.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">No trades recorded yet.</p>
        ) : (
          <div className="space-y-0">
            {trades.map((trade, index) => {
              const hasChildren = trade.children.length > 0;
              const expanded = expandedGroups.has(trade.id);
              const signedTotal = hasChildren
                ? trade.children.reduce(
                    (sum, child) => sum + getSignedTradePrice(child),
                    0
                  )
                : getSignedTradePrice(trade);

              return (
                <div
                  key={trade.id}
                  className="border-b border-border/30 px-3 py-2.5 text-sm text-foreground transition-[filter] hover:brightness-110 last:border-b-0"
                  style={{
                    backgroundColor:
                      index % 2 === 0
                        ? "rgba(16, 12, 9, 0.5)"
                        : "rgba(22, 16, 12, 0.75)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-10 shrink-0 text-xs text-muted-foreground">
                      {formatTradeDateShort(trade.created_at)}
                    </span>
                    <div className="w-px shrink-0 self-stretch bg-border/30" aria-hidden="true" />
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleGroup(trade.id)}
                          className="shrink-0 text-left"
                          aria-expanded={expanded}
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform duration-200 ${
                              expanded ? "rotate-0" : "-rotate-90"
                            }`}
                          />
                        </button>
                      ) : null}
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <span className={`shrink-0 ${getActionBadgeClass(trade.action)}`}>
                          {formatTradeAction(trade.action)}
                        </span>
                        <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                          {trade.description}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatSignedPrice({ action: trade.action, price: signedTotal })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {trade.notes ? (
                    <p className="mt-1 whitespace-normal break-words pl-[3.75rem] text-xs leading-snug text-muted-foreground">
                      {trade.notes}
                    </p>
                  ) : null}
                  {hasChildren && expanded ? (
                    <div className="mt-2 space-y-0 border-t border-border/30 pt-2">
                      {trade.children.map((child, childIndex) => (
                        <div
                          key={child.id}
                          className={`flex items-center gap-3 px-3 py-2 ${
                            childIndex > 0 ? "border-t border-border/20" : ""
                          }`}
                        >
                          <span className="w-10 shrink-0 text-xs text-muted-foreground">
                            {formatTradeDateShort(child.created_at)}
                          </span>
                          <div className="w-px shrink-0 self-stretch bg-border/20" aria-hidden="true" />
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            <span className={`shrink-0 ${getActionBadgeClass(child.action)}`}>
                              {formatTradeAction(child.action)}
                            </span>
                            <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                              {child.description}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatSignedPrice(child)}
                            </span>
                          </div>
                          {child.notes ? (
                            <p className="w-full whitespace-normal break-words pl-[3.75rem] text-xs leading-snug text-muted-foreground">
                              {child.notes}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
