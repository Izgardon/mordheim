import { useEffect, useMemo, useRef, useState } from "react";

import DiceRoller from "@/components/dice/DiceRoller";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createWarbandLog } from "@/features/warbands/api/warbands-api";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { Dices } from "lucide-react";

type CampaignDiceRollerMenuProps = {
  className?: string;
  iconClassName?: string;
  label?: string;
};

const MIN_DICE_COUNT = 1;
const MAX_DICE_COUNT = 10;
const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseDiceValues = (results: unknown): number[] => {
  const extractValues = (entry: unknown): number[] => {
    if (!entry) {
      return [];
    }
    if (typeof entry === "number") {
      return Number.isFinite(entry) ? [entry] : [];
    }
    if (entry && typeof entry === "object" && "rolls" in entry) {
      const rolls = (entry as { rolls?: unknown }).rolls;
      if (Array.isArray(rolls)) {
        return rolls
          .map((roll) => {
            if (typeof roll === "number") {
              return roll;
            }
            if (roll && typeof roll === "object" && "value" in roll) {
              const value = Number((roll as { value?: unknown }).value);
              return Number.isFinite(value) ? value : null;
            }
            return null;
          })
          .filter((value): value is number => Number.isFinite(value));
      }
    }
    if (entry && typeof entry === "object" && "value" in entry) {
      const value = Number((entry as { value?: unknown }).value);
      return Number.isFinite(value) ? [value] : [];
    }
    return [];
  };

  if (Array.isArray(results)) {
    return results.flatMap(extractValues);
  }

  return extractValues(results);
};

export default function CampaignDiceRollerMenu({
  className,
  iconClassName,
  label,
}: CampaignDiceRollerMenuProps) {
  const { warband, diceColor } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const reasonInputRef = useRef<HTMLInputElement | null>(null);
  const focusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen && focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
  }, [isOpen]);

  const handleOpenAutoFocus = (event: Event) => {
    if (!isMobile) {
      return;
    }
    event.preventDefault();
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
    }
    focusTimerRef.current = window.setTimeout(() => {
      reasonInputRef.current?.focus();
      reasonInputRef.current?.scrollIntoView({ block: "center" });
    }, 320);
  };
  const [diceCount, setDiceCount] = useState(2);
  const [diceSides, setDiceSides] = useState<(typeof DICE_SIDES)[number]>(6);
  const [reason, setReason] = useState("");
  const [lastRollValues, setLastRollValues] = useState<number[]>([]);
  const [lastRollTotal, setLastRollTotal] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [rollSignal, setRollSignal] = useState(0);
  const [error, setError] = useState("");

  const notation = useMemo(() => `${diceCount}d${diceSides}`, [diceCount, diceSides]);
  const canRoll = Boolean(warband && !isRolling);

  const handleDiceCountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    if (!Number.isFinite(nextValue)) {
      return;
    }
    setDiceCount(clamp(nextValue, MIN_DICE_COUNT, MAX_DICE_COUNT));
  };

  const handleDiceSidesChange = (value: string) => {
    const nextValue = Number(value);
    if (!DICE_SIDES.includes(nextValue as (typeof DICE_SIDES)[number])) {
      return;
    }
    setDiceSides(nextValue as (typeof DICE_SIDES)[number]);
  };

  const handleRoll = () => {
    if (!canRoll) {
      return;
    }
    setError("");
    setRollSignal((prev) => prev + 1);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setIsOpen(nextOpen);
    if (!nextOpen) {
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
      setRollSignal(0);
      setIsRolling(false);
    }
  };

  const handleRollComplete = (results: unknown) => {
    const rolls = parseDiceValues(results);
    const total = rolls.reduce((sum, value) => sum + value, 0);
    setLastRollValues(rolls);
    setLastRollTotal(total);

    if (!warband) {
      return;
    }

    const reasonValue = reason.trim();
    void createWarbandLog(
      warband.id,
      {
        feature: "dice_roll",
        entry_type: "dice_roll",
        payload: {
          warband: warband.name || "Warband",
          dice: notation,
          rolls,
          total,
          ...(reasonValue ? { reason: reasonValue } : {}),
        },
      },
      { emitUpdate: false }
    ).catch((logError) => {
      console.error("Failed to log custom dice roll", logError);
      setError("Roll completed, but logging failed.");
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "icon-button relative flex h-9 w-9 items-center justify-center border-none bg-transparent p-0",
            className
          )}
          aria-label={label ?? "Dice roller"}
          title="Custom Dice Roller"
        >
          <Dices className={cn("h-5 w-5 text-[#e9dcc2]", iconClassName)} aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[32rem]" onOpenAutoFocus={handleOpenAutoFocus}>
        <DialogHeader className="items-start text-left">
          <DialogTitle>Custom Dice Roll</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="custom-dice-count">Number of Dice</Label>
              <NumberInput
                id="custom-dice-count"
                min={MIN_DICE_COUNT}
                max={MAX_DICE_COUNT}
                value={diceCount}
                onChange={handleDiceCountChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-dice-sides">Dice Type</Label>
              <Select value={String(diceSides)} onValueChange={handleDiceSidesChange}>
                <SelectTrigger id="custom-dice-sides">
                  <SelectValue placeholder="Select dice type" />
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

          <div className="space-y-2">
            <Label htmlFor="custom-dice-reason">Reason</Label>
            <Input
              id="custom-dice-reason"
              ref={reasonInputRef}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why are you rolling?"
            />
          </div>

          <div className="space-y-1 rounded-xl border border-[#2b2117]/80 bg-[#0f0c09] p-3 text-sm">
            <p className="text-[0.6rem] uppercase tracking-[0.25em] text-muted-foreground">
              Result
            </p>
            <p className="text-foreground">
              Rolls: {lastRollValues.length ? lastRollValues.join(", ") : "-"}
            </p>
            <p className="text-foreground">Total: {lastRollTotal ?? "-"}</p>
            <p className="text-muted-foreground">Dice: {notation}</p>
          </div>

          {!warband ? (
            <p className="text-xs text-muted-foreground">
              Create a warband first to roll and write to logs.
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end">
            <Button onClick={handleRoll} disabled={!canRoll}>
              {isRolling ? "Rolling..." : `Roll ${notation}`}
            </Button>
          </div>
        </div>

        <DiceRoller
          fixedNotation={notation}
          fullScreen
          variant="button-only"
          showRollButton={false}
          themeColor={diceColor}
          rollSignal={rollSignal}
          onRollComplete={handleRollComplete}
          onRollingChange={setIsRolling}
        />
      </DialogContent>
    </Dialog>
  );
}
