import { useCallback, useEffect, useRef, useState } from "react";

// components
import { Button } from "@components/button";
import { NumberInput } from "@components/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";

// utils
import { cn } from "@/lib/utils";
import { useDice } from "./dice-context";
import { sumDice } from "./dice-utils";

const DEFAULT_FIXED_NOTATION = "2d6";
const DICE_SIDES = [3, 4, 6, 8, 10, 12, 20, 100] as const;
const MAX_DICE = 20;
const DEFAULT_DICE_COLOR = "#2e8555";

export type DiceRollerMode = "fixed" | "custom";

export type DiceRollerProps = {
  mode?: DiceRollerMode;
  fixedNotation?: string;
  variant?: "default" | "button-only";
  showResultBox?: boolean;
  showRollButton?: boolean;
  showRollLabel?: boolean;
  rollButtonPrefix?: string;
  resultBoxClassName?: string;
  themeColor?: string;
  resultMode?: "total" | "dice" | "both";
  rollSignal?: number;
  rollDisabled?: boolean;
  /** Receives the die values of the roll. */
  onRollComplete?: (values: number[]) => void;
  onTotalChange?: (total: number) => void;
  onRollingChange?: (isRolling: boolean) => void;
};

/** Roll button and result box; the dice themselves roll in DiceProvider's shared overlay. */
export default function DiceRoller({
  mode = "fixed",
  fixedNotation = DEFAULT_FIXED_NOTATION,
  variant = "default",
  showResultBox = true,
  showRollButton = true,
  showRollLabel = true,
  rollButtonPrefix = "Roll ",
  resultBoxClassName,
  themeColor,
  resultMode = "total",
  rollSignal,
  rollDisabled = false,
  onRollComplete,
  onTotalChange,
  onRollingChange,
}: DiceRollerProps) {
  const { roll, preload } = useDice();
  const onRollCompleteRef = useRef(onRollComplete);
  const onTotalChangeRef = useRef(onTotalChange);
  const lastHandledRollSignal = useRef<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [diceCount, setDiceCount] = useState(2);
  const [diceSides, setDiceSides] = useState<(typeof DICE_SIDES)[number]>(6);
  const [lastRollValues, setLastRollValues] = useState<number[]>([]);
  const resolvedThemeColor = themeColor ?? DEFAULT_DICE_COLOR;
  const lastRollTotal = sumDice(lastRollValues);

  useEffect(() => {
    onRollCompleteRef.current = onRollComplete;
    onTotalChangeRef.current = onTotalChange;
  }, [onRollComplete, onTotalChange]);

  useEffect(() => {
    onRollingChange?.(isRolling);
  }, [isRolling, onRollingChange]);

  // Warm the shared engine while the roller is on screen, as the per-roller engine used to.
  useEffect(() => {
    preload();
  }, [preload]);

  const rollNotation = mode === "custom" ? `${diceCount}d${diceSides}` : fixedNotation;
  const rollButtonText = `${rollButtonPrefix}${rollNotation}`;

  const handleRoll = useCallback(async () => {
    if (rollDisabled) {
      return;
    }
    setIsRolling(true);
    try {
      const values = await roll(rollNotation, { themeColor: resolvedThemeColor });
      setLastRollValues(values);
      onRollCompleteRef.current?.(values);
      onTotalChangeRef.current?.(sumDice(values));
    } finally {
      setIsRolling(false);
    }
  }, [resolvedThemeColor, roll, rollDisabled, rollNotation]);

  useEffect(() => {
    if (rollSignal === undefined || rollSignal <= 0) {
      return;
    }
    if (rollSignal === lastHandledRollSignal.current || isRolling) {
      return;
    }
    lastHandledRollSignal.current = rollSignal;
    void handleRoll();
  }, [rollSignal, isRolling, handleRoll]);

  const rollButton = (
    <Button onClick={() => void handleRoll()} disabled={isRolling || rollDisabled}>
      {isRolling ? "Rolling..." : rollButtonText}
    </Button>
  );

  if (variant === "button-only") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-end gap-3">
          {showRollButton ? rollButton : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {mode === "custom" ? (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Dice
            </span>
            <div className="flex items-center gap-2">
              <NumberInput
                min={1}
                max={MAX_DICE}
                value={diceCount}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isNaN(value)) {
                    return;
                  }
                  setDiceCount(Math.max(1, Math.min(MAX_DICE, value)));
                }}
                className="w-20"
              />
              <Select
                value={String(diceSides)}
                onValueChange={(value) => {
                  setDiceSides(Number(value) as (typeof DICE_SIDES)[number]);
                }}
              >
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {DICE_SIDES.map((side) => (
                    <SelectItem key={side} value={String(side)}>
                      d{side}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {showRollButton ? (
            <div className="flex flex-col gap-2">
              {showRollLabel ? (
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Roll
                </span>
              ) : null}
              {rollButton}
            </div>
          ) : null}
          {showResultBox ? (
            <div
              className={cn(
                "h-8 min-w-[60px] flex items-center rounded-2xl border border-border/60 bg-background/70 px-3 shadow-[0_12px_24px_rgba(5,20,24,0.25)]",
                resultBoxClassName
              )}
            >
              {lastRollValues.length ? (
                <div className="flex items-center gap-2">
                  {resultMode === "dice" || resultMode === "both" ? (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {lastRollValues.map((value, index) => (
                        <span
                          key={`${value}-${index}`}
                          className="rounded-full border border-border/70 bg-muted/30 py-0.5"
                        >
                          {value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {resultMode === "total" || resultMode === "both" ? (
                    <p className="text-lg font-semibold text-foreground">{lastRollTotal}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-lg font-semibold text-foreground">-</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
