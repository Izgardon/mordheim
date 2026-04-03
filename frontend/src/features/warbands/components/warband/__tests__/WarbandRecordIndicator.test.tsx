import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WarbandRecordIndicator from "../WarbandRecordIndicator";

describe("WarbandRecordIndicator", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      x: 100,
      y: 100,
      top: 100,
      left: 100,
      bottom: 140,
      right: 180,
      width: 80,
      height: 40,
      toJSON: () => ({}),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows battles fought and reveals wins and losses in a tooltip", async () => {
    render(<WarbandRecordIndicator wins={3} losses={2} />);

    const trigger = screen.getByLabelText("Battles fought: 5. Wins: 3. Losses: 2.");
    expect(trigger).toHaveTextContent("5");

    fireEvent.mouseEnter(trigger);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Warband Record");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Wins");
    expect(screen.getByRole("tooltip")).toHaveTextContent("3");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Losses");
    expect(screen.getByRole("tooltip")).toHaveTextContent("2");
  });

  it("falls back to zero when wins and losses are missing", () => {
    render(<WarbandRecordIndicator wins={null} losses={undefined} variant="mobile" />);

    expect(screen.getByLabelText("Battles fought: 0. Wins: 0. Losses: 0.")).toHaveTextContent("0");
  });
});
