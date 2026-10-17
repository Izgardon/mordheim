/**
 * Race maximums (decision 10, BUG-32): the rules cap each characteristic at the race's maximum,
 * but house rules and hand fixes differ, so the app warns and never blocks.
 */
export type OverRaceMax = { label: string; value: number; max: number };

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** The stats (by label) whose value is above the race maximum for that label. */
export function statsOverRaceMax(
  labels: readonly string[],
  values: Record<string, unknown>,
  maxima: Record<string, unknown> | null | undefined
): OverRaceMax[] {
  if (!maxima) return [];
  return labels.flatMap((label) => {
    const value = toNumber(values[label]);
    const max = toNumber(maxima[label]);
    return value !== null && max !== null && value > max ? [{ label, value, max }] : [];
  });
}

/** "WS 7 (max 6), S 5 (max 4)" */
export const describeOverRaceMax = (over: readonly OverRaceMax[]) =>
  over.map(({ label, value, max }) => `${label} ${value} (max ${max})`).join(", ");
