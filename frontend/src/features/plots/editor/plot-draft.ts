import type { Plot, PlotInput } from "../types/plot-types";

/** One scoring line being written: its points as typed (blank for a die), its dice and its text. */
export type ScoringDraft = { points: string; dice: string; text: string };
export type RungDraft = { points: string; name: string; text: string };

export type PlotDraft = {
  name: string;
  who_text: string;
  scoring: ScoringDraft[];
  achievements: RungDraft[];
};

/** The ladder a new plot starts with: the book's seven rungs, which skip 30. */
export const BOOK_RUNGS = [5, 10, 15, 20, 25, 35, 40];

export const BLANK_SCORING: ScoringDraft = { points: "", dice: "", text: "" };

export function blankDraft(): PlotDraft {
  return {
    name: "",
    who_text: "",
    scoring: [{ ...BLANK_SCORING }],
    achievements: BOOK_RUNGS.map((points) => ({ points: String(points), name: "", text: "" })),
  };
}

export function draftOf(plot: Plot): PlotDraft {
  return {
    name: plot.name,
    who_text: plot.who_text,
    scoring: plot.scoring.map((line) => ({
      points: line.points === null ? "" : String(line.points),
      dice: line.dice,
      text: line.text,
    })),
    achievements: plot.achievements.map((rung) => ({
      points: String(rung.points),
      name: rung.name,
      text: rung.text,
    })),
  };
}

const number = (value: string) => {
  const parsed = Number(value.trim());
  return value.trim() === "" || Number.isNaN(parsed) ? null : Math.trunc(parsed);
};

/** The draft as the server takes it: a line with no points and no dice scores nothing, and says so. */
export function inputOf(draft: PlotDraft): PlotInput {
  return {
    name: draft.name.trim(),
    who_text: draft.who_text.trim(),
    scoring: draft.scoring
      .filter((line) => line.text.trim() || line.points.trim() || line.dice.trim())
      .map((line) => ({
        points: number(line.points),
        dice: line.dice.trim(),
        text: line.text.trim(),
      })),
    achievements: draft.achievements
      .filter((rung) => number(rung.points) !== null)
      .map((rung) => ({
        points: number(rung.points) as number,
        name: rung.name.trim(),
        text: rung.text.trim(),
      })),
  };
}
