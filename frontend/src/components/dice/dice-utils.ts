export const parseDiceNotation = (notation: string): { count: number; sides: number } | null => {
  const match = notation.match(/^(\d+)d(\d+)$/i);
  if (!match) {
    return null;
  }
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  if (count > 0 && sides > 0) {
    return { count, sides };
  }
  return null;
};

/** Random values for a notation such as "2d6", used when the 3D engine is unavailable. */
export const generateFallbackRoll = (notation: string): number[] => {
  const parsed = parseDiceNotation(notation);
  if (!parsed) {
    return [Math.floor(Math.random() * 6) + 1];
  }
  const values: number[] = [];
  for (let i = 0; i < parsed.count; i++) {
    values.push(Math.floor(Math.random() * parsed.sides) + 1);
  }
  return values;
};

/** Die values from a dice-box result (numbers, `{ value }` dice or `{ rolls }` groups). */
export const parseDiceValues = (results: unknown): number[] => {
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

export const sumDice = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
