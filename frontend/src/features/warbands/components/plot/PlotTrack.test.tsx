/**
 * The campaign point track: a box per point up to forty, filled to the warband's total, with its
 * plot's rungs drawn heavy and numbered. The rungs come from the plot, not from the book's seven,
 * and a ladder or a total past forty stretches the track.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PlotTrack from "./PlotTrack";

const BOOK_RUNGS = [5, 10, 15, 20, 25, 35, 40];

describe("PlotTrack", () => {
  it("draws forty boxes, filled to the total, and names the rungs it marks", () => {
    render(<PlotTrack total={12} rungs={BOOK_RUNGS} />);

    const track = screen.getByRole("img");
    expect(track).toHaveAccessibleName(
      "12 of 40 campaign points; achievements at 5, 10, 15, 20, 25, 35 and 40"
    );
    expect(track.children).toHaveLength(40);
    // the rungs are the only numbered boxes (no 30: the book's track has none)
    expect([...track.children].map((box) => box.textContent).filter(Boolean)).toEqual(
      BOOK_RUNGS.map(String)
    );
  });

  it("marks the rungs of a plot's own ladder and stretches past forty for them", () => {
    render(<PlotTrack total={0} rungs={[3, 7, 45]} />);

    const track = screen.getByRole("img");
    expect(track).toHaveAccessibleName("0 of 45 campaign points; achievements at 3, 7 and 45");
    expect(track.children).toHaveLength(45);
  });

  it("stretches for a total past the track, and says so without a ladder", () => {
    render(<PlotTrack total={44} rungs={[]} />);

    expect(screen.getByRole("img")).toHaveAccessibleName("44 of 44 campaign points");
  });
});
