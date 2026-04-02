import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MobileLayout from "../MobileLayout";
import { reloadMobileLayout } from "../mobile-refresh";

vi.mock("../mobile-refresh", () => ({
  reloadMobileLayout: vi.fn(),
}));

describe("MobileLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reloads when pulled down from the top past the refresh threshold", () => {
    render(
      <MobileLayout>
        <div>Campaign content</div>
      </MobileLayout>
    );

    const scrollContainer = screen.getByTestId("mobile-layout-scroll");
    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });

    fireEvent.touchStart(scrollContainer, {
      touches: [{ clientY: 0 }],
    });
    fireEvent.touchMove(scrollContainer, {
      touches: [{ clientY: 200 }],
    });

    expect(screen.getByText("Release to refresh")).toBeInTheDocument();

    fireEvent.touchEnd(scrollContainer);

    expect(reloadMobileLayout).toHaveBeenCalledTimes(1);
  });

  it("does not reload when the list is not at the top", () => {
    render(
      <MobileLayout>
        <div>Campaign content</div>
      </MobileLayout>
    );

    const scrollContainer = screen.getByTestId("mobile-layout-scroll");
    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      value: 24,
      writable: true,
    });

    fireEvent.touchStart(scrollContainer, {
      touches: [{ clientY: 0 }],
    });
    fireEvent.touchMove(scrollContainer, {
      touches: [{ clientY: 200 }],
    });
    fireEvent.touchEnd(scrollContainer);

    expect(reloadMobileLayout).not.toHaveBeenCalled();
  });
});
