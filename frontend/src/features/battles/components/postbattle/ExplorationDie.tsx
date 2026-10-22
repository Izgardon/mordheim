import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

/** One exploration die: chosen or not, its value (typed or rolled), and a re-roll. */
export default function ExplorationDie({
  index,
  value,
  chosen,
  chooseDisabled,
  disabled,
  rerollDisabled,
  onChooseChange,
  onValueChange,
  onReroll,
}: {
  index: number;
  value: number | null;
  chosen: boolean;
  chooseDisabled: boolean;
  disabled: boolean;
  rerollDisabled: boolean;
  onChooseChange: (chosen: boolean) => void;
  onValueChange: (rawValue: string) => void;
  onReroll: () => void;
}) {
  return (
    <div className="battle-inline-panel flex w-fit items-center gap-2 px-3 py-2">
      <label className="flex min-w-10 flex-col items-center gap-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        <span>D{index + 1}</span>
        <Checkbox
          checked={chosen}
          disabled={chooseDisabled}
          onChange={(event) => onChooseChange(event.target.checked)}
        />
      </label>
      <Input
        value={value ?? ""}
        placeholder="-"
        inputMode="numeric"
        disabled={disabled}
        className="field-surface h-10 w-10 min-w-10 max-w-10 flex-none !rounded-none px-0 text-center text-base font-semibold"
        onFocus={(event) => {
          const input = event.currentTarget; // gone from the event by the next frame
          window.requestAnimationFrame(() => {
            input.select();
          });
        }}
        onMouseUp={(event) => {
          event.preventDefault();
          event.currentTarget.select();
        }}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="h-10 w-10 shrink-0"
        disabled={rerollDisabled}
        onClick={onReroll}
        aria-label={`Reroll die ${index + 1}`}
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}
