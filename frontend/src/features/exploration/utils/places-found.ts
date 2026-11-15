import type { ExplorationChart, ExplorationPlace } from "../types/exploration-types";

/** A place the dice found: the multiple that found it ("Triples 3·3·3") and the chart's place. */
export type FoundPlace = { kicker: string; face: number; count: number; place: ExplorationPlace };

/**
 * Each face rolled two or more times among the chosen dice, with the place the campaign's chart
 * gives for it: the most of a kind first, then the highest face. More of a kind than the chart
 * names places for reads as its largest multiple. Nothing without a chart.
 */
export function placesFound(chart: ExplorationChart | undefined, values: number[]): FoundPlace[] {
  const multiples = chart?.multiples ?? [];
  if (multiples.length === 0) return [];
  const most = multiples[multiples.length - 1].count;
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .flatMap(([face, count]) => {
      const row = multiples.find((entry) => entry.count === Math.min(count, most));
      const place = row?.places.find((entry) => entry.face === face);
      if (!row || !place) return [];
      const kicker = `${row.label} ${Array.from({ length: count }, () => face).join("·")}`;
      return [{ kicker, face, count, place }];
    });
}
