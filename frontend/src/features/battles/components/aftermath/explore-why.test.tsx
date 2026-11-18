/**
 * The exploration's "why" line. The dice do not recalculate once rolled, so the words beside them
 * must not either (William, 12 Nov 2026): declaring a different result, or standing a hero up on
 * the Injuries step, used to change "3 heroes on their feet, +1 for winning" while the dice stayed
 * put.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { exploreWhy, useExploreWhy } from "./explore-why";

function Harness({ rolled, onFeet, won }: { rolled: boolean; onFeet: number; won: boolean }) {
  return <span>{useExploreWhy(rolled, exploreWhy(onFeet, won))}</span>;
}

describe("exploreWhy", () => {
  it("counts the heroes on their feet and the win", () => {
    expect(exploreWhy(3, true)).toBe("3 heroes on their feet, +1 for winning");
    expect(exploreWhy(1, false)).toBe("1 hero on their feet");
  });
});

describe("useExploreWhy", () => {
  it("follows the battle until the dice are rolled, then describes the roll that happened", () => {
    const { rerender } = render(<Harness rolled={false} onFeet={3} won={false} />);
    expect(screen.getByText("3 heroes on their feet")).toBeInTheDocument();

    rerender(<Harness rolled={false} onFeet={3} won />);
    expect(screen.getByText("3 heroes on their feet, +1 for winning")).toBeInTheDocument();

    // rolled, and then the victor and the injuries change: the dice stay, so the words do too
    rerender(<Harness rolled onFeet={3} won />);
    rerender(<Harness rolled onFeet={1} won={false} />);
    expect(screen.getByText("3 heroes on their feet, +1 for winning")).toBeInTheDocument();
  });

  it("follows the battle again once the dice are cleared", () => {
    const { rerender } = render(<Harness rolled onFeet={3} won />);
    rerender(<Harness rolled={false} onFeet={2} won={false} />);

    expect(screen.getByText("2 heroes on their feet")).toBeInTheDocument();
  });

  it("holds the words of a roll that was already in when the page opened", () => {
    const { rerender } = render(<Harness rolled onFeet={4} won />);
    rerender(<Harness rolled onFeet={0} won={false} />);

    expect(screen.getByText("4 heroes on their feet, +1 for winning")).toBeInTheDocument();
  });
});
