/**
 * The exploration chart's multiples (doubles to sixes): the place each finds, by the face shown
 * (index 0 is a 1). Reference names only: the shards come from the server's table, and the place's
 * rules and D6 results are the campaign's locations, where "Read and roll" opens them.
 */
const MULTIPLES: Record<number, { label: string; places: string[] }> = {
  2: {
    label: "Doubles",
    places: ["Well", "Shop", "Corpse", "Straggler", "Overturned Cart", "Ruined Hovels"],
  },
  3: {
    label: "Triples",
    places: ["Tavern", "Smithy", "Prisoners", "Fletcher", "Market Hall", "Returning a Favour"],
  },
  4: {
    label: "Four of a kind",
    places: ["Gunsmith", "Shrine", "Townhouse", "Armourer", "Graveyard", "Catacombs"],
  },
  5: {
    label: "Five of a kind",
    places: [
      "Moneylender's House",
      "Alchemist's Laboratory",
      "Jewelsmith",
      "Merchant's House",
      "Shattered Building",
      "Entrance to the Catacombs",
    ],
  },
  6: {
    label: "Six of a kind",
    places: [
      "The Pit",
      "Hidden Treasure",
      "Dwarf Smithy",
      "Slaughtered Warband",
      "Fighting Arena",
      "Noble's Villa",
    ],
  },
};

export type ExplorationMultiple = { kicker: string; face: number; count: number; place: string };

/** Each face rolled two or more times among the chosen dice, with the place it finds. */
export function explorationMultiples(values: number[]): ExplorationMultiple[] {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .map(([face, count]) => {
      const entry = MULTIPLES[Math.min(count, 6)];
      return {
        kicker: `${entry.label} ${Array.from({ length: count }, () => face).join("·")}`,
        face,
        count,
        place: entry.places[face - 1],
      };
    });
}
