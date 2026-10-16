import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardBackground } from "./card-background";

describe("CardBackground", () => {
  it("renders the id on the element, so it can be used as a scroll anchor", () => {
    render(
      <CardBackground as="section" id="battle-postbattle-section-exploration">
        Exploration
      </CardBackground>
    );

    const section = screen.getByText("Exploration");
    expect(section.tagName).toBe("SECTION");
    expect(section).toHaveAttribute("id", "battle-postbattle-section-exploration");
  });
});
