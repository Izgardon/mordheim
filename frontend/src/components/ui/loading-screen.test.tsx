import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingScreen } from "./loading-screen";

describe("LoadingScreen", () => {
  it("announces the message and draws the spinner inline, with no external assets", () => {
    const { container } = render(<LoadingScreen message="Preparing the campaign..." />);

    expect(screen.getByRole("status")).toHaveTextContent("Preparing the campaign...");
    expect(container.querySelector("svg.sword-clash")).not.toBeNull();
    // The old Lottie player fetched its animation and WASM from third-party CDNs.
    expect(container.querySelector("canvas, img, iframe, object")).toBeNull();
  });
});
