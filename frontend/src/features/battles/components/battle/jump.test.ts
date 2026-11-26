/**
 * The phone's Jump button cycles through the shown side's sections (William, 26 Nov 2026): down
 * to the next heading below the scroll position, and from the last back up to the first.
 */
import { describe, expect, it } from "vitest";

import { nextJump } from "./jump";

const headings = [
  { label: "Heroes", top: 140 },
  { label: "Henchmen", top: 900 },
  { label: "Hired swords", top: 1500 },
];
const MAX = 1800;

describe("nextJump", () => {
  it("goes down through the sections in order", () => {
    expect(nextJump(headings, 0, MAX)).toEqual({ label: "Heroes", top: 140, up: false });
    expect(nextJump(headings, 140, MAX)).toEqual({ label: "Henchmen", top: 900, up: false });
    expect(nextJump(headings, 900, MAX)).toEqual({ label: "Hired swords", top: 1500, up: false });
  });

  it("follows a manual scroll: the next stop is the heading after the one in view", () => {
    expect(nextJump(headings, 400, MAX)).toEqual({ label: "Henchmen", top: 900, up: false });
    expect(nextJump(headings, 1200, MAX)).toEqual({ label: "Hired swords", top: 1500, up: false });
  });

  it("points up on the last section and goes back to the first", () => {
    expect(nextJump(headings, 1500, MAX)).toEqual({ label: "Heroes", top: 140, up: true });
    expect(nextJump(headings, MAX, MAX)).toEqual({ label: "Heroes", top: 140, up: true });
  });

  it("wraps at the bottom of the list when the last heading can't reach the top", () => {
    // the list ends before Hired swords could be scrolled up to the top
    expect(nextJump(headings, 900, 1200)).toEqual({
      label: "Hired swords",
      top: 1200,
      up: false,
    });
    expect(nextJump(headings, 1200, 1200)).toEqual({ label: "Heroes", top: 140, up: true });
  });

  it("goes back to the top of the list when the first heading is already as high as it goes", () => {
    const short = [
      { label: "Heroes", top: 500 },
      { label: "Henchmen", top: 700 },
    ];
    expect(nextJump(short, 0, 500)).toEqual({ label: "Heroes", top: 500, up: false });
    expect(nextJump(short, 500, 500)).toEqual({ label: "Heroes", top: 0, up: true });
  });

  it("has nowhere to go with one section or none", () => {
    expect(nextJump([headings[0]], 0, MAX)).toBeNull();
    expect(nextJump([], 0, MAX)).toBeNull();
  });
});
