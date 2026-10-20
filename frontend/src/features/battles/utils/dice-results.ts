/** The dice values in a DiceRoller result: numbers, `{rolls}` groups or `{value}` dice. */
export function parseDiceValues(results: unknown): number[] {
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
}

/** The result's dice as D6 values (1 to 6), at most `expectedCount` of them. */
export function toD6Values(results: unknown, expectedCount?: number) {
  return parseDiceValues(results)
    .map((value) => Math.max(1, Math.min(6, Math.trunc(value || 1))))
    .slice(0, expectedCount ?? Number.POSITIVE_INFINITY);
}
