import { useState } from "react";

import { Button } from "@components/button";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import DiceRoller from "@/components/dice/DiceRoller";

type PriceSectionProps = {
  cost: number;
  variable?: string | null;
  finalPrice: number;
  onFinalPriceChange: (price: number) => void;
};

export default function PriceSection({
  cost,
  variable,
  finalPrice,
  onFinalPriceChange,
}: PriceSectionProps) {
  const [increaseDiceCount, setIncreaseDiceCount] = useState(1);
  const [decreaseDiceCount, setDecreaseDiceCount] = useState(1);
  const [increaseResult, setIncreaseResult] = useState<number | null>(null);
  const [decreaseResult, setDecreaseResult] = useState<number | null>(null);
  const [increaseRollSignal, setIncreaseRollSignal] = useState(0);
  const [decreaseRollSignal, setDecreaseRollSignal] = useState(0);

  const handleIncreaseDiceCountChange = (value: number) => {
    const clamped = Math.max(1, Math.min(10, value));
    setIncreaseDiceCount(clamped);
  };

  const handleDecreaseDiceCountChange = (value: number) => {
    const clamped = Math.max(1, Math.min(10, value));
    setDecreaseDiceCount(clamped);
  };

  const handleIncreaseRoll = () => {
    setIncreaseRollSignal((prev) => prev + 1);
  };

  const handleDecreaseRoll = () => {
    setDecreaseRollSignal((prev) => prev + 1);
  };

  const handleIncreaseTotal = (total: number) => {
    setIncreaseResult(total);
    onFinalPriceChange(finalPrice + total);
  };

  const handleDecreaseTotal = (total: number) => {
    setDecreaseResult(total);
    onFinalPriceChange(Math.max(0, finalPrice - total));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-border/40 bg-background/40 p-3">
          <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Increase
          </Label>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Dice
              </Label>
              <NumberInput
                min={1}
                max={10}
                value={String(increaseDiceCount)}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!Number.isNaN(value)) {
                    handleIncreaseDiceCountChange(value);
                  }
                }}
                className="w-20"
              />
            </div>
            <Button size="sm" variant="secondary" onClick={handleIncreaseRoll}>
              Roll {increaseDiceCount}d6
            </Button>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Result
              </Label>
              <div className="flex h-10 min-w-[50px] items-center justify-center rounded-lg border border-border/60 bg-background/70 px-2 text-sm font-semibold text-foreground">
                {increaseResult !== null ? `+${increaseResult}` : "-"}
              </div>
            </div>
          </div>
          <DiceRoller
            mode="fixed"
            fixedNotation={`${increaseDiceCount}d6`}
            fullScreen
            variant="button-only"
            showRollButton={false}
            rollSignal={increaseRollSignal}
            onTotalChange={handleIncreaseTotal}
          />
        </div>

        <div className="space-y-2 rounded-lg border border-border/40 bg-background/40 p-3">
          <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">
            Decrease
          </Label>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Dice
              </Label>
              <NumberInput
                min={1}
                max={10}
                value={String(decreaseDiceCount)}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!Number.isNaN(value)) {
                    handleDecreaseDiceCountChange(value);
                  }
                }}
                className="w-20"
              />
            </div>
            <Button size="sm" variant="secondary" onClick={handleDecreaseRoll}>
              Roll {decreaseDiceCount}d6
            </Button>
              <div className="space-y-1 flex h-10 min-w-[50px] items-center justify-center rounded-lg border border-border/60 bg-background/70 px-2 text-sm font-semibold text-foreground">
                {decreaseResult !== null ? `-${decreaseResult}` : "-"}
              </div>
          </div>
          <DiceRoller
            mode="fixed"
            fixedNotation={`${decreaseDiceCount}d6`}
            fullScreen
            variant="button-only"
            showRollButton={false}
            rollSignal={decreaseRollSignal}
            onTotalChange={handleDecreaseTotal}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Base price
            </Label>
            <div className="flex h-11 min-w-[80px] items-center rounded-2xl border border-border/60 bg-background/70 px-3 text-sm text-muted-foreground shadow-[0_12px_24px_rgba(5,20,24,0.25)]">
              {cost} gc
            </div>
          </div>
          {variable ? (
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Variable
              </Label>
              <div className="flex h-11 min-w-[80px] items-center rounded-2xl border border-border/60 bg-background/70 px-3 text-sm text-muted-foreground shadow-[0_12px_24px_rgba(5,20,24,0.25)]">
                {variable}
              </div>
            </div>
          ) : null}
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Final price
          </Label>
          <NumberInput
            min={0}
            value={String(finalPrice)}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!Number.isNaN(value)) {
                onFinalPriceChange(Math.max(0, value));
              }
            }}
            className="w-28"
          />
        </div>
      </div>
    </div>
  );
}
