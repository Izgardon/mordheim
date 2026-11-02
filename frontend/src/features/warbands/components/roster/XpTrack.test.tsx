import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import XpTrack from "./XpTrack";

const HENCHMEN = [2, 5, 9, 14];
const ticks = (container: HTMLElement) => container.querySelectorAll("svg").length;
const fills = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>(".bg-primary.h-2")].map((bar) => bar.style.width);

describe("XpTrack", () => {
  it("fills each block of the table and ticks the complete ones, half points included", () => {
    const { container } = render(<XpTrack xp={6.5} thresholds={HENCHMEN} />);
    expect(fills(container)).toEqual(["100%", "100%", "37.5%", "0%"]);
    expect(ticks(container)).toBe(2);
  });

  it("ticks a block's box with its animation only when added XP completes it", () => {
    const { container, rerender } = render(<XpTrack xp={4} thresholds={HENCHMEN} />);
    expect(container.querySelectorAll(".xp-tick")).toHaveLength(0);
    rerender(<XpTrack xp={5} thresholds={HENCHMEN} />);
    expect(container.querySelectorAll(".xp-tick")).toHaveLength(1);
    expect(ticks(container)).toBe(2);
  });

  it("shows the current block, two after it and at most eight", () => {
    const table = [2, 4, 6, 8, 11, 14, 17, 20, 24, 28, 32, 36];
    const { container } = render(<XpTrack xp={25} thresholds={table} />);
    expect(fills(container)).toHaveLength(8);
  });
});
