import { useCallback, useEffect, useState } from "react";

import { NumberInput } from "@/components/ui/number-input";
import { useMediaQuery } from "@/lib/use-media-query";

/** A whole-number input (XP, upkeep) that commits its value, clamped, when it loses focus. */
export default function PostbattleStepperInput({
  value,
  min = 0,
  max,
  disabled,
  onCommit,
}: {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(() => String(value));
  const [isFocused, setIsFocused] = useState(false);
  const isMobile = useMediaQuery("(max-width: 960px)");

  useEffect(() => {
    if (!isFocused) {
      setDraftValue(String(value));
    }
  }, [isFocused, value]);

  const normalizeValue = useCallback(
    (rawValue: string) => {
      const parsed = Number(rawValue);
      let nextValue = Number.isFinite(parsed) ? Math.trunc(parsed) : value;
      nextValue = Math.max(min, nextValue);
      if (typeof max === "number") {
        nextValue = Math.min(max, nextValue);
      }
      return nextValue;
    },
    [max, min, value]
  );

  const commitValue = useCallback(() => {
    const nextValue = normalizeValue(draftValue);
    setDraftValue(String(nextValue));
    onCommit(nextValue);
  }, [draftValue, normalizeValue, onCommit]);

  return (
    <NumberInput
      value={draftValue}
      min={min}
      max={max}
      step={1}
      disabled={disabled}
      compact
      inputSize="sm"
      className={isMobile ? "w-10 !px-0 text-center text-sm" : "w-[5rem] !px-2 text-left text-sm"}
      containerClassName="h-9"
      onChange={(event) => setDraftValue(event.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        commitValue();
      }}
    />
  );
}
