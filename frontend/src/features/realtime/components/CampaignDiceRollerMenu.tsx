import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import DiceRoller from "@/components/dice/DiceRoller";
import { parseDiceValues } from "@/components/dice/dice-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createWarbandLog } from "@/features/warbands/api/warbands-api";
import { markLedgerStale } from "@/features/warbands/api/warband-cache";
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
const DICE_SIDES = [3, 4, 6, 8, 10, 12, 20, 100] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function CampaignDiceRollerMenu({
  className,
  iconClassName,
  label,
}: CampaignDiceRollerMenuProps) {
  const { warband, diceColor } = useAppStore();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
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
    void createWarbandLog(warband.id, {
      feature: "dice_roll",
      entry_type: "dice_roll",
      payload: {
        warband: warband.name || "Warband",
        dice: notation,
        rolls,
        total,
        ...(reasonValue ? { reason: reasonValue } : {}),
      },
    })
      .then(() => markLedgerStale(queryClient, warband.id))
      .catch((logError) => {
        console.error("Failed to log dice roll", logError);
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
          title="Dice Roller"
        >
          <Dices className={cn("theme-heading-soft h-5 w-5", iconClassName)} aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[32rem]">
        <DialogHeader className="items-start text-left">
          <DialogTitle>Dice Roller</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why are you rolling?"
            />
          </div>

          <div className="surface-panel-strong space-y-1 rounded-xl p-3 text-sm">
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
