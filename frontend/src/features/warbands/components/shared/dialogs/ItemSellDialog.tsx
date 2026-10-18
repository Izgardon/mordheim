import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";
import { Button } from "@components/button";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import CostPicker from "./CostPicker";
import { ANY_COST, pickedCost, saleUnitPrice } from "../../../utils/stash-costs";

import type { SalePriceBasis } from "@/features/items/types/item-types";
import type { StashCost } from "../../../types/warband-types";

type ItemSellDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemCost?: number | null;
  /** One copy's suggested price from the server (decision 3); not sent: half the item's cost. */
  suggestedPrice?: number | null;
  priceBasis?: SalePriceBasis | null;
  /** The stash's copies by cost (BUG-117): with several, the player picks which to sell. */
  costs?: StashCost[];
  maxQuantity: number;
  description?: string;
  confirmLabel?: string;
  errorMessage?: string;
  /** `cost` only when the player picked copies of one cost. */
  onConfirm: (payload: {
    quantity: number;
    price: number;
    cost?: number | null;
  }) => Promise<void> | void;
};

/** Where the starting price comes from, under the price field. */
const BASIS_NOTES: Record<SalePriceBasis | "none", string> = {
  campaign_price: "Suggested: half the current price.",
  stored_cost: "Suggested: from the stored cost; this item is no longer in the catalogue.",
  none: "No price is known for this item; enter one.",
};

export default function ItemSellDialog({
  open,
  onOpenChange,
  itemName,
  itemCost,
  suggestedPrice,
  priceBasis,
  costs,
  maxQuantity,
  description = "Set the sell price and confirm",
  confirmLabel = "Sell",
  errorMessage = "Failed to sell item",
  onConfirm,
}: ItemSellDialogProps) {
  const [costChoice, setCostChoice] = useState(ANY_COST);
  // The price for `qty` copies of the picked cost: the suggestion times the quantity.
  const priceFor = (qty: number, choice = costChoice) => {
    const picked = pickedCost(costs, choice);
    const unit = saleUnitPrice({ suggested: suggestedPrice, basis: priceBasis, picked, itemCost });
    return unit === null ? "" : String(unit * qty);
  };
  const picked = pickedCost(costs, costChoice);
  const maxCopies = picked ? Math.min(maxQuantity, picked.quantity) : maxQuantity;
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState(() => priceFor(1));
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const basisNote =
    suggestedPrice === undefined
      ? ""
      : BASIS_NOTES[suggestedPrice === null ? "none" : (priceBasis ?? "none")];

  const clampQuantity = (value: string, max = maxCopies) =>
    Math.max(1, Math.min(Number(value) || 1, max));

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setCostChoice(ANY_COST);
      setQuantity("1");
      setPrice(priceFor(1, ANY_COST));
      setPriceManuallyEdited(false);
      setError("");
      setIsSubmitting(false);
    }
  };

  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    if (!priceManuallyEdited) {
      setPrice(priceFor(clampQuantity(value)));
    }
  };

  const handleCostChange = (choice: string) => {
    setCostChoice(choice);
    const next = pickedCost(costs, choice);
    const qty = clampQuantity(quantity, next ? Math.min(maxQuantity, next.quantity) : maxQuantity);
    setQuantity(String(qty));
    if (!priceManuallyEdited) {
      setPrice(priceFor(qty, choice));
    }
  };

  const handlePriceChange = (value: string) => {
    setPrice(value);
    setPriceManuallyEdited(true);
  };

  const handleSell = async () => {
    setError("");
    setIsSubmitting(true);
    const sellQty = clampQuantity(quantity);
    const sellPrice = Number(price) || 0;
    try {
      await onConfirm({
        quantity: sellQty,
        price: sellPrice,
        ...(picked ? { cost: picked.cost } : {}),
      });
      handleOpenChange(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || errorMessage);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Sell {itemName}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          <span className="text-sm font-semibold italic text-foreground">{itemCost ?? 0} gc</span>
        </DialogHeader>
        <div className="space-y-4">
          <CostPicker costs={costs} value={costChoice} onChange={handleCostChange} />
          {maxCopies > 1 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Quantity</Label>
              <NumberInput
                min={1}
                max={maxCopies}
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Sell Price</Label>
            <NumberInput
              min={0}
              value={price}
              onChange={(e) => handlePriceChange(e.target.value)}
            />
            {basisNote ? <p className="text-xs text-muted-foreground">{basisNote}</p> : null}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSell} disabled={isSubmitting || price.trim() === ""}>
            {isSubmitting ? "Selling..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
