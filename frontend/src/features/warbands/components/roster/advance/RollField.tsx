import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { rollDice } from "@/lib/dice";

/** Roll the dice, or type what was rolled at the table: "Roll 2D6" beside a box for the total. */
export default function RollField({
  dice,
  value,
  onChange,
}: {
  /** How many D6. */
  dice: 1 | 2;
  value: number | null;
  onChange: (roll: number | null) => void;
}) {
  const [min, max] = dice === 2 ? [2, 12] : [1, 6];
  const label = dice === 2 ? "2D6" : "D6";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        onClick={() => onChange(rollDice(dice).reduce((sum, die) => sum + die, 0))}
      >
        Roll {label}
      </Button>
      <NumberInput
        compact
        inputSize="sm"
        aria-label={`${label} rolled`}
        min={min}
        max={max}
        className="w-14 text-base font-bold"
        value={value === null ? "" : String(value)}
        onChange={(event) => {
          const typed = Number(event.target.value);
          onChange(event.target.value === "" || !Number.isFinite(typed) ? null : typed);
        }}
      />
    </div>
  );
}
