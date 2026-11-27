import { useState } from "react";

import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";

/**
 * Sell, then its price in place to change before the sale (the copies' suggested price at first)
 * and "Sell for N gc", which sells.
 */
export default function SellControl({
  suggested,
  onSell,
  className,
}: {
  suggested: number;
  onSell: (price: number) => void;
  /** The buttons' size class (a unit's item row keeps them small). */
  className?: string;
}) {
  const [selling, setSelling] = useState(false);
  const [price, setPrice] = useState(String(suggested));
  const sellFor = Number(price) || 0;

  return selling ? (
    <span className="flex items-center gap-1.5">
      <NumberInput
        compact
        aria-label="Sale price"
        inputSize="sm"
        className="h-8 w-16"
        containerClassName="h-8"
        value={price}
        onChange={(event) => setPrice(event.target.value)}
      />
      <Button size="sm" className={className} onClick={() => onSell(sellFor)}>
        Sell for {sellFor} gc
      </Button>
    </span>
  ) : (
    <Button size="sm" variant="secondary" className={className} onClick={() => setSelling(true)}>
      Sell
    </Button>
  );
}
