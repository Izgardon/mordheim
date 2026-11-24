import { useState } from "react";

import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useSetScenarioWeight } from "../api/scenario-queries";

/** "1", "1.5": a weight as the box shows it. */
export const weightText = (weight: number) => String(Number(weight.toFixed(2)));

/**
 * A row's weight in the random draw, edited in place (step 0.5, at or above 0), saved when the
 * box is left or Enter is pressed; a manager's only, the others see the number.
 */
export default function WeightField({
  campaignId,
  rowId,
  weight,
  name,
  canEdit,
}: {
  campaignId: number;
  rowId: number;
  weight: number;
  name: string;
  canEdit: boolean;
}) {
  const save = useSetScenarioWeight(campaignId);
  const [typed, setTyped] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!canEdit) {
    return (
      <span aria-label={`Weight of ${name}`} className="font-mono text-[13px] text-ink">
        {weightText(weight)}×
      </span>
    );
  }
  const commit = () => {
    if (typed === null) return;
    const next = Number(typed);
    setTyped(null);
    if (typed.trim() === "" || !Number.isFinite(next) || next < 0) {
      setError("A weight is 0 or more.");
      return;
    }
    if (next === weight) return;
    setError("");
    save.mutate(
      { rowId, weight: next },
      { onError: (failure) => setError(getErrorMessage(failure, "Couldn't save the weight.")) }
    );
  };
  return (
    <span className="flex flex-col items-end gap-0.5">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={0.5}
        aria-label={`Weight of ${name}`}
        aria-invalid={error ? true : undefined}
        value={typed ?? weightText(weight)}
        onChange={(event) => setTyped(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={cn(
          "h-9 w-[72px] border border-strong bg-page px-2 text-right font-mono text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          error && "border-danger"
        )}
      />
      {error ? <span className="text-[11px] font-semibold text-danger">{error}</span> : null}
    </span>
  );
}
