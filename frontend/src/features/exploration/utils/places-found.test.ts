import { describe, expect, it } from "vitest";

import type { ExplorationChart } from "../types/exploration-types";
import { placesFound } from "./places-found";

const place = (face: number, name: string, rules = "") => ({ id: face * 10, face, name, rules });
const chart = {
  multiples: [
    {
      count: 2,
      label: "Doubles",
      places: [place(1, "Well", "A Toughness test."), place(3, "Corpse")],
    },
    { count: 3, label: "Triples", places: [place(3, "Prisoners", "2D6 gc.")] },
  ],
} as ExplorationChart;

describe("placesFound", () => {
  it("names the place for each multiple, most of a kind first", () => {
    const found = placesFound(chart, [3, 3, 3, 1, 1]);
    expect(found.map((entry) => entry.place.name)).toEqual(["Prisoners", "Well"]);
    expect(found[0].kicker).toBe("Triples 3·3·3");
    expect(found[0].place.rules).toBe("2D6 gc.");
  });

  it("reads more of a kind than the chart names as its largest multiple", () => {
    expect(placesFound(chart, [3, 3, 3, 3]).map((entry) => entry.place.name)).toEqual([
      "Prisoners",
    ]);
  });

  it("finds nothing without a multiple, a chart, or a place for the face", () => {
    expect(placesFound(chart, [1, 2, 3])).toEqual([]);
    expect(placesFound(undefined, [1, 1])).toEqual([]);
    expect(placesFound(chart, [2, 2])).toEqual([]);
  });
});
