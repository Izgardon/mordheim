import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RatingLabel from "./RatingLabel";

describe("RatingLabel (step 5 follow-up)", () => {
  it("shows the server's rating alone when nothing is unsaved", () => {
    const { container } = render(<RatingLabel rating={123} />);

    expect(container).toHaveTextContent(/^123$/);
  });

  it("marks the saved rating while a section has unsaved changes", () => {
    const { container } = render(<RatingLabel rating={123} unsaved />);

    expect(container).toHaveTextContent("123 (unsaved changes)");
    expect(screen.getByText("123")).toBeInTheDocument();
  });
});
