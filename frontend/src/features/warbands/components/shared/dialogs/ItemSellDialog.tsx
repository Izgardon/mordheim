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

type ItemSellDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemCost?: number | null;
  maxQuantity: number;
  description?: string;
  confirmLabel?: string;
  errorMessage?: string;
  onConfirm: (payload: { quantity: number; price: number }) => Promise<void> | void;
};

function sellPriceForQty(cost: number, qty: number) {
  return Math.ceil(cost / 2) * qty;
}

export default function ItemSellDialog({
  open,
  onOpenChange,
  itemName,
  itemCost,
  maxQuantity,
  description = "Set the sell price and confirm",
  confirmLabel = "Sell",
  errorMessage = "Failed to sell item",
  onConfirm,
}: ItemSellDialogProps) {
  const unitPrice = Math.ceil((itemCost ?? 0) / 2);
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState(String(unitPrice));
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setQuantity("1");
      setPrice(String(unitPrice));
      setPriceManuallyEdited(false);
      setError("");
      setIsSubmitting(false);
    }
  };

  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    if (!priceManuallyEdited) {
      const qty = Math.max(1, Math.min(Number(value) || 1, maxQuantity));
      setPrice(String(sellPriceForQty(itemCost ?? 0, qty)));
    }
  };

  const handlePriceChange = (value: string) => {
    setPrice(value);
    setPriceManuallyEdited(true);
  };

  const handleSell = async () => {
    setError("");
    setIsSubmitting(true);

    const sellQty = Math.max(1, Math.min(Number(quantity) || 1, maxQuantity));
    const sellPrice = Number(price) || 0;

    try {
      await onConfirm({ quantity: sellQty, price: sellPrice });
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sell {itemName}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          <span className="text-sm font-semibold italic text-foreground">{itemCost ?? 0} gc</span>
        </DialogHeader>
        <div className="space-y-4">
          {maxQuantity > 1 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Quantity</Label>
              <NumberInput
                min={1}
                max={maxQuantity}
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
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleSell} disabled={isSubmitting}>
            {isSubmitting ? "Selling..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
