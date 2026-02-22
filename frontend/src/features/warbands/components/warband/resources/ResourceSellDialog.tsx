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

type ResourceSellDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceName: string;
  maxQuantity: number;
  description?: string;
  confirmLabel?: string;
  errorMessage?: string;
  onConfirm: (payload: { quantity: number; price: number }) => Promise<void> | void;
};

export default function ResourceSellDialog({
  open,
  onOpenChange,
  resourceName,
  maxQuantity,
  description = "Set the quantity and price to sell.",
  confirmLabel = "Sell",
  errorMessage = "Failed to sell resource.",
  onConfirm,
}: ResourceSellDialogProps) {
  const [quantity, setQuantity] = useState("0");
  const [price, setPrice] = useState("0");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setQuantity("0");
      setPrice("0");
      setError("");
      setIsSubmitting(false);
    }
  };

  const handleSell = async () => {
    setError("");
    setIsSubmitting(true);

    const sellQty = Math.max(0, Math.min(Number(quantity) || 0, maxQuantity));
    const sellPrice = Math.max(0, Number(price) || 0);

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

  const resolvedQuantity = Math.max(0, Math.min(Number(quantity) || 0, maxQuantity));
  const resolvedPrice = Math.max(0, Number(price) || 0);
  const isConfirmDisabled = isSubmitting || resolvedQuantity === 0 || resolvedPrice === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Sell {resourceName}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Quantity</Label>
            <NumberInput
              min={0}
              max={maxQuantity}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Max: {maxQuantity}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Price</Label>
            <NumberInput
              min={0}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSell} disabled={isConfirmDisabled}>
            {isSubmitting ? "Selling..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
