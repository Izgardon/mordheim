import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DetailPopup from "./DetailPopup";

vi.mock("./DetailCardContent", () => ({
  default: () => <div>Mock detail content</div>,
}));

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

const anchorRect = {
  x: 80,
  y: 620,
  top: 620,
  left: 80,
  bottom: 660,
  right: 120,
  width: 40,
  height: 40,
  toJSON: () => ({}),
} as DOMRect;

describe("DetailPopup", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
      writable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
      writable: true,
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      x: 132,
      y: 364,
      top: 364,
      left: 132,
      bottom: 784,
      right: 452,
      width: 320,
      height: 420,
      toJSON: () => ({}),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps reporting the measured bottom-clamped position when the parent rerenders", async () => {
    const onClose = vi.fn();
    const onPositionCalculated = vi.fn();
    const { rerender } = render(
      <DetailPopup
        entry={{ id: 1, type: "item", name: "Sword" }}
        onClose={onClose}
        anchorRect={anchorRect}
        onPositionCalculated={(position) => onPositionCalculated(position)}
      />
    );

    await waitFor(() => expect(onPositionCalculated).toHaveBeenCalledTimes(1));
    expect(onPositionCalculated).toHaveBeenLastCalledWith({
      top: 364,
      left: 132,
      width: 320,
      height: 420,
    });

    await act(async () => {
      rerender(
        <DetailPopup
          entry={{ id: 1, type: "item", name: "Sword" }}
          onClose={onClose}
          anchorRect={anchorRect}
          onPositionCalculated={(position) => onPositionCalculated(position)}
        />
      );
    });

    expect(onPositionCalculated).toHaveBeenCalledTimes(1);
  });
});
