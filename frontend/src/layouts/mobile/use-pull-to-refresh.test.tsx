import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePullToRefresh } from "./use-pull-to-refresh";

function Page({ onRefresh = vi.fn(async () => undefined) }: { onRefresh?: () => Promise<void> }) {
  const pull = usePullToRefresh({ enabled: true, onRefresh });
  return (
    <div ref={pull.scrollRef} data-testid="scroll">
      <p>{pull.isPulling ? `Pulling ${pull.pullDistance}` : "Resting"}</p>
      <div className="scroll-row" data-testid="pills">
        Pills
      </div>
      <p>Roster</p>
    </div>
  );
}

/** A finger from (0, 0) through each point; answers the last move. */
function swipe(target: Element, points: [number, number][]) {
  fireEvent.touchStart(target, { touches: [{ clientX: 0, clientY: 0 }] });
  let last = createEvent.touchMove(target, { touches: [], cancelable: true });
  for (const [clientX, clientY] of points) {
    last = createEvent.touchMove(target, { touches: [{ clientX, clientY }], cancelable: true });
    fireEvent(target, last);
  }
  return last;
}

const pulling = () => screen.queryByText(/^Pulling/) !== null;

describe("usePullToRefresh", () => {
  it("waits for a pull past the activation distance", () => {
    render(<Page />);
    const page = screen.getByText("Roster");

    for (const distance of [20, 40, 48]) {
      const move = swipe(page, [[0, distance]]);
      expect(pulling()).toBe(false);
      expect(move.defaultPrevented).toBe(false);
      fireEvent.touchEnd(page);
    }

    const move = swipe(page, [
      [0, 40],
      [0, 140],
    ]);
    expect(pulling()).toBe(true);
    expect(move.defaultPrevented).toBe(true);
  });

  it("refreshes past the threshold as before", () => {
    const onRefresh = vi.fn(async () => undefined);
    render(<Page onRefresh={onRefresh} />);
    const page = screen.getByText("Roster");

    swipe(page, [[0, 260]]);
    fireEvent.touchEnd(page);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("ignores a sideways swipe for the rest of the touch", () => {
    const onRefresh = vi.fn(async () => undefined);
    render(<Page onRefresh={onRefresh} />);
    const page = screen.getByText("Roster");

    swipe(page, [
      [30, 5],
      [30, 260],
    ]);
    expect(pulling()).toBe(false);
    fireEvent.touchEnd(page);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("needs a pull clearly downward as it starts", () => {
    render(<Page />);
    const page = screen.getByText("Roster");

    swipe(page, [
      [8, 9],
      [60, 100],
    ]);

    expect(pulling()).toBe(false);
  });

  it("never pulls from a row that scrolls sideways", () => {
    render(<Page />);

    swipe(screen.getByTestId("pills"), [[0, 260]]);

    expect(pulling()).toBe(false);
  });

  it("never pulls while a dialog or sheet is open", () => {
    render(<Page />);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);

    swipe(screen.getByText("Roster"), [[0, 260]]);

    expect(pulling()).toBe(false);
    dialog.remove();
  });
});
