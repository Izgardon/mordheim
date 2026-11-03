import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import XpTrack, { xpBlock } from "./XpTrack";

const HERO = [2, 4, 6, 8, 11, 14];
const fill = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("[data-xp-fill]")?.style.width;
const points = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>("[data-xp-point]")].map((line) => line.style.left);
const levelUp = (container: HTMLElement) => container.querySelectorAll("[data-xp-level-up]").length;

describe("xpBlock", () => {
  it("is the range from the last advance reached to the next", () => {
    expect(xpBlock(7, HERO)).toMatchObject({ index: 3, from: 6, to: 8, share: 0.5 });
    expect(xpBlock(0, HERO)).toMatchObject({ index: 0, from: 0, to: 2, share: 0 });
    expect(xpBlock(8, HERO)).toMatchObject({ index: 4, from: 8, to: 11, share: 0 });
  });

  it("fills a half point as half a step", () => {
    expect(xpBlock(6.5, HERO).share).toBe(0.25);
    expect(xpBlock(9.5, HERO).share).toBe(0.5);
  });

  it("marks each XP point inside the range", () => {
    expect(xpBlock(7, HERO).points).toEqual([0.5]);
    expect(xpBlock(9, HERO).points).toEqual([1 / 3, 2 / 3]);
  });

  it("is the last block, full, past the table", () => {
    expect(xpBlock(20, HERO)).toMatchObject({ index: 6, from: 11, to: 14, share: 1 });
  });
});

describe("XpTrack", () => {
  afterEach(() => vi.useRealTimers());

  it("shows the current block only, with a faint line at each point", () => {
    const { container } = render(<XpTrack xp={9} thresholds={HERO} />);
    expect(fill(container)).toBe(`${(1 / 3) * 100}%`);
    expect(points(container)).toEqual([`${(1 / 3) * 100}%`, `${(2 / 3) * 100}%`]);
    expect(container.querySelectorAll("svg")).toHaveLength(0); // no box at its end (William)
    expect(levelUp(container)).toBe(0);
  });

  it("grows the fill inside a block", () => {
    const { container, rerender } = render(<XpTrack xp={8} thresholds={HERO} />);
    rerender(<XpTrack xp={9} thresholds={HERO} />);
    expect(fill(container)).toBe(`${(1 / 3) * 100}%`);
    expect(levelUp(container)).toBe(0);
  });

  it("fills the bar and plays its level-up when an advance is reached, then starts the next block", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<XpTrack xp={7} thresholds={HERO} />);
    rerender(<XpTrack xp={9} thresholds={HERO} />);
    expect(fill(container)).toBe("100%");
    expect(levelUp(container)).toBe(1);
    expect(points(container)).toEqual(["50%"]);
    act(() => void vi.advanceTimersByTime(1160));
    expect(fill(container)).toBe("0%");
    expect(levelUp(container)).toBe(0);
    act(() => void vi.advanceTimersByTime(40));
    expect(fill(container)).toBe(`${(1 / 3) * 100}%`);
    expect(points(container)).toHaveLength(2);
  });
});
