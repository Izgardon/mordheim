import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Tooltip } from "./tooltip";

describe("Tooltip", () => {
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

  const renderTooltip = () =>
    render(
      <Tooltip
        data-testid="tooltip-trigger"
        trigger={<button type="button">Trigger</button>}
        content="Tooltip content"
      />
    );

  const dispatchTouchPointerEvent = (
    eventName: "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel",
    target: HTMLElement,
    coordinates?: { clientX: number; clientY: number }
  ) => {
    const resolvedCoordinates = coordinates ?? { clientX: 0, clientY: 0 };
    const event = createEvent[eventName](target, resolvedCoordinates);

    Object.defineProperties(event, {
      pointerId: { value: 1 },
      pointerType: { value: "touch" },
      clientX: { value: resolvedCoordinates.clientX },
      clientY: { value: resolvedCoordinates.clientY },
    });

    fireEvent(target, event);
  };

  it("opens and closes on mouse hover", async () => {
    renderTooltip();

    const trigger = screen.getByTestId("tooltip-trigger");

    fireEvent.mouseEnter(trigger);

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Tooltip content");

    fireEvent.mouseLeave(trigger);

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  it("opens on a stationary touch tap", async () => {
    renderTooltip();

    const trigger = screen.getByTestId("tooltip-trigger");

    dispatchTouchPointerEvent("pointerDown", trigger, {
      clientX: 120,
      clientY: 130,
    });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    dispatchTouchPointerEvent("pointerUp", trigger, {
      clientX: 120,
      clientY: 130,
    });

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Tooltip content");
  });

  it("does not open after a touch gesture turns into a scroll", () => {
    renderTooltip();

    const trigger = screen.getByTestId("tooltip-trigger");

    dispatchTouchPointerEvent("pointerDown", trigger, {
      clientX: 120,
      clientY: 130,
    });
    dispatchTouchPointerEvent("pointerMove", trigger, {
      clientX: 132,
      clientY: 130,
    });
    dispatchTouchPointerEvent("pointerUp", trigger, {
      clientX: 132,
      clientY: 130,
    });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("does not open after the touch gesture is cancelled", () => {
    renderTooltip();

    const trigger = screen.getByTestId("tooltip-trigger");

    dispatchTouchPointerEvent("pointerDown", trigger, {
      clientX: 120,
      clientY: 130,
    });
    dispatchTouchPointerEvent("pointerCancel", trigger);
    dispatchTouchPointerEvent("pointerUp", trigger, {
      clientX: 120,
      clientY: 130,
    });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
