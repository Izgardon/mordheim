import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GoldLabel from "./GoldLabel";

describe("GoldLabel (decision 1)", () => {
  it("shows the gold as it is when nothing is pending", () => {
    render(<GoldLabel gold={500} />);

    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("shows what is left after Save, with the pending amount", () => {
    const { container } = render(<GoldLabel gold={500} pending={60} />);

    expect(container).toHaveTextContent("440 gc (60 pending)");
    expect(screen.getByText("440 gc")).not.toHaveClass("text-red-400");
  });

  it("shows a shortfall in red instead of clamping it at zero", () => {
    render(<GoldLabel gold={40} pending={60} />);

    expect(screen.getByText("-20 gc")).toHaveClass("text-red-400");
  });

  it("shows gold below zero in red: a warband may overspend (decision 2)", () => {
    render(<GoldLabel gold={-15} />);

    expect(screen.getByText("-15")).toHaveClass("text-red-400");
  });
});
