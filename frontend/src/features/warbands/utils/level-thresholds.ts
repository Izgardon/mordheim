export const DEFAULT_HERO_LEVEL_THRESHOLDS = [
  2, 4, 6, 8, 11, 14, 17, 20, 24, 28, 32, 36, 41, 46, 51, 57, 63, 69, 76, 83,
  90,
] as const;

export const DEFAULT_HENCHMEN_LEVEL_THRESHOLDS = [2, 5, 9, 14] as const;

type ThresholdInput = Array<number | string> | null | undefined;

const isPositiveInteger = (value: number) =>
  Number.isFinite(value) && value > 0 && Math.floor(value) === value;

export const normalizeThresholdList = (
  values: ThresholdInput,
  fallback: readonly number[],
) => {
  if (!values || values.length === 0) {
    return [...fallback];
  }

  const cleaned = values
    .map((value) => Number(value))
    .filter((value) => isPositiveInteger(value));

  const unique = Array.from(new Set(cleaned)).sort((a, b) => a - b);
  return unique.length ? unique : [...fallback];
};

export const parseThresholdText = (value: string) => {
  const tokens = value.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) {
    return { values: [], error: "Enter at least one threshold." };
  }

  const parsed: number[] = [];
  for (const token of tokens) {
    const numberValue = Number(token);
    if (!isPositiveInteger(numberValue)) {
      return { values: [], error: "Use positive whole numbers only." };
    }
    parsed.push(numberValue);
  }

  const unique = Array.from(new Set(parsed)).sort((a, b) => a - b);
  return { values: unique, error: "" };
};

export const formatThresholdList = (values: readonly number[]) => values.join(", ");
