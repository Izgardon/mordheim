import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CardBackground } from "@components/card-background";
import { Input } from "@components/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TRADE_ACTIONS = [
  "Purchased",
  "Sold",
  "Upkeep",
  "Exploration",
  "Reward",
  "Bought",
  "Hired",
] as const;

import { listWarbandTrades, createWarbandTrade } from "../../api/warbands-api";

import type { Warband, WarbandTrade, WarbandTradePayload } from "../../types/warband-types";

type TradesTabProps = {
  warband: Warband;
  canEdit?: boolean;
  onTradeCreated?: (trade: WarbandTrade) => void;
};

export default function TradesTab({
  warband,
  canEdit = false,
  onTradeCreated,
}: TradesTabProps) {
  const [trades, setTrades] = useState<WarbandTrade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formAction, setFormAction] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    setError("");
    listWarbandTrades(warband.id)
      .then((data) => {
        if (!isActive) {
          return;
        }
        setTrades(data);
      })
      .catch((errorResponse) => {
        if (!isActive) {
          return;
        }
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load trades");
        } else {
          setError("Unable to load trades");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [warband.id]);

  const resetForm = () => {
    setFormAction("");
    setFormDescription("");
    setFormPrice("");
    setFormNotes("");
    setSubmitError("");
  };

  const handleOpenForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    const trimmedAction = formAction.trim();
    const trimmedDescription = formDescription.trim();
    const priceValue = parseInt(formPrice, 10) || 0;

    if (!trimmedAction) {
      setSubmitError("Action is required.");
      return;
    }
    if (!trimmedDescription) {
      setSubmitError("Description is required.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const payload: WarbandTradePayload = {
      action: trimmedAction,
      description: trimmedDescription,
      price: priceValue,
      notes: formNotes.trim(),
    };

    try {
      const newTrade = await createWarbandTrade(warband.id, payload);
      setTrades((prev) => [newTrade, ...prev]);
      onTradeCreated?.(newTrade);
      handleCloseForm();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setSubmitError(errorResponse.message || "Unable to create trade");
      } else {
        setSubmitError("Unable to create trade");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTradeAction = (action: string) => {
    const normalized = action.trim().toLowerCase();
    const actionMap: Record<string, string> = {
      purchase: "Purchased",
      purchased: "Purchased",
      buy: "Bought",
      bought: "Bought",
      sell: "Sold",
      sold: "Sold",
      hire: "Hired",
      hired: "Hired",
      upkeep: "Upkeep",
      exploration: "Exploration",
      reward: "Reward",
      "starting gold": "Starting Gold",
    };
    return actionMap[normalized] ?? action;
  };

  const formatTradeDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
      return "";
    }
    return date.toLocaleDateString();
  };

  const warbandName = warband.name || "this warband";

  return (
    <CardBackground className="space-y-4 p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex flex-wrap items-baseline gap-2 text-foreground">
              <span className="text-sm font-semibold tracking-[0.2em] text-muted-foreground">
                Trade ledger for
              </span>
              <span className="text-2xl font-semibold">{warbandName}</span>
            </h2>
          </div>
          {canEdit && !isFormOpen && (
            <Button size="sm" onClick={handleOpenForm}>
              Trade
            </Button>
          )}
        </div>

        {isFormOpen && (
          <div className="space-y-3 border border-border/60 bg-background/80 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
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
                placeholder="What was traded?"
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
            {submitError && (
              <p className="text-sm text-red-600">{submitError}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={isSubmitting} size="sm">
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="secondary"
                onClick={handleCloseForm}
                disabled={isSubmitting}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

      <div className="max-h-[60vh] space-y-2 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading trades...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : trades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trades recorded yet.</p>
        ) : (
          trades.map((trade) => (
            <div
              key={trade.id}
              className="border border-border/60 bg-background/80 px-3 py-2 text-sm text-foreground"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatTradeAction(trade.action)}</span>
                  <span className="text-muted-foreground">-</span>
                  <span>{trade.description}</span>
                  {trade.price !== 0 && (
                    <span className="text-muted-foreground">
                      ({trade.price > 0 ? "+" : ""}{trade.price} gc)
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatTradeDate(trade.created_at)}
                </span>
              </div>
              {trade.notes && (
                <p className="mt-1 text-xs text-muted-foreground">{trade.notes}</p>
              )}
            </div>
          ))
        )}
      </div>
    </CardBackground>
  );
}
