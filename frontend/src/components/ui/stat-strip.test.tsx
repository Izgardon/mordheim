import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { STAT_KEYS, StatStrip } from "./stat-strip";

describe("StatStrip", () => {
  it("shows the ten characteristics in order, with a dash for a missing value", () => {
    render(<StatStrip values={{ M: 8, WS: 4, BS: 4, S: 3, T: 3, W: 1, I: 4, A: 1, Ld: 8 }} />);

    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    expect(terms).toEqual([...STAT_KEYS]);
    const sv = screen.getByText("Sv").parentElement as HTMLElement;
    expect(within(sv).getByRole("definition")).toHaveTextContent("–");
  });

  it("picks out the highlighted cells, as the mounted M and Sv", () => {
    render(<StatStrip values={{ M: 8, Sv: "4+" }} highlighted={["M", "Sv"]} />);

    const highlighted = screen
      .getAllByRole("term")
      .filter((term) => term.parentElement?.hasAttribute("data-highlighted"))
      .map((term) => term.textContent);
    expect(highlighted).toEqual(["M", "Sv"]);
  });
});
