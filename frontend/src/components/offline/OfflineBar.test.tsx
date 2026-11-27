import { onlineManager } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import OfflineBar from "./OfflineBar";

const LINE = "You’re offline. Showing what this phone last saw.";

afterEach(() => {
  vi.restoreAllMocks();
  act(() => onlineManager.setOnline(true));
});

describe("the offline bar", () => {
  it("shows nothing while online", () => {
    render(<OfflineBar />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows while the browser says it is offline, and goes when it is back", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<OfflineBar />);
    expect(screen.getByRole("status")).toHaveTextContent(LINE);

    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows while TanStack's online manager has paused the reads", () => {
    render(<OfflineBar />);
    act(() => onlineManager.setOnline(false));
    expect(screen.getByRole("status")).toHaveTextContent(LINE);

    act(() => onlineManager.setOnline(true));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
