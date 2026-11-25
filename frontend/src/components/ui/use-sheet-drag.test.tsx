import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BottomSheet } from "./bottom-sheet";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { SHEET_DISMISS_DISTANCE } from "./use-sheet-drag";

vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));

let clock = 0;
beforeEach(() => {
  clock = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});
afterEach(() => vi.restoreAllMocks());

function Harness({ onTap = vi.fn() }: { onTap?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      kicker="Battle 5"
      title="Rules"
      footer={<button type="button">Done</button>}
    >
      <div data-testid="body-content">
        <button type="button" onClick={onTap}>
          Melee
        </button>
        <input aria-label="Notes" />
        <div className="scroll-row" data-testid="pills">
          Pills
        </div>
        <div data-no-sheet-drag="" data-testid="marked">
          Marked
        </div>
      </div>
    </BottomSheet>
  );
}

/** The sheet's scrolling body, made to scroll as a browser would lay it out. */
function scrollingBody(scrollTop: number) {
  const body = screen.getByTestId("body-content").parentElement as HTMLElement;
  body.style.overflowY = "auto";
  Object.defineProperty(body, "scrollHeight", { configurable: true, value: 900 });
  Object.defineProperty(body, "clientHeight", { configurable: true, value: 400 });
  Object.defineProperty(body, "scrollTop", {
    configurable: true,
    writable: true,
    value: scrollTop,
  });
  return body;
}

/** A touch event's points at (x, y): react-remove-scroll reads changedTouches, the hook touches. */
const at = (clientX: number, clientY: number) => {
  const point = [{ clientX, clientY }];
  return { touches: point, changedTouches: point };
};

/** A finger from (0, 400) through each step's offset, `ms` apart; answers the moves sent. */
function drag(target: Element, steps: [number, number][], ms = 40) {
  fireEvent.touchStart(target, at(0, 400));
  const moves = steps.map(([dx, dy]) => {
    clock += ms;
    const move = createEvent.touchMove(target, { ...at(dx, 400 + dy), cancelable: true });
    fireEvent(target, move);
    return move;
  });
  clock += 10;
  act(() => {
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 0, clientY: 0 }] });
  });
  return moves;
}

const down = (distance: number, parts = 4) =>
  Array.from({ length: parts }, (_, i) => [0, ((i + 1) * distance) / parts] as [number, number]);

const sheetOpen = () => screen.queryByRole("dialog") !== null;

describe("useSheetDrag", () => {
  it("closes when the header is dragged down past the distance, the sheet following the finger", () => {
    render(<Harness />);
    const title = screen.getByText("Rules");

    fireEvent.touchStart(title, at(0, 400));
    clock += 40;
    fireEvent.touchMove(title, at(0, 450));
    expect(screen.getByRole("dialog").style.transform).toBe("translateY(50px)");
    clock += 400; // slow: no flick
    fireEvent.touchMove(title, at(0, 400 + SHEET_DISMISS_DISTANCE + 10));
    clock += 400;
    act(() => {
      fireEvent.touchEnd(title, at(0, 0));
    });

    expect(sheetOpen()).toBe(false);
  });

  it("springs back from a short slow drag", () => {
    render(<Harness />);

    drag(screen.getByText("Battle 5"), down(SHEET_DISMISS_DISTANCE - 20), 200);

    const sheet = screen.getByRole("dialog");
    expect(sheet.style.transform).toBe("");
    expect(sheet.style.transition).toContain("transform");
  });

  it("closes on a quick flick shorter than the distance", () => {
    render(<Harness />);

    drag(screen.getByText("Rules"), down(50, 3), 15);

    expect(sheetOpen()).toBe(false);
  });

  it("drags from the footer and from the body at its top", () => {
    render(<Harness />);
    scrollingBody(0);
    drag(screen.getByText("Melee"), down(SHEET_DISMISS_DISTANCE + 40), 200);
    expect(sheetOpen()).toBe(false);

    render(<Harness />);
    drag(screen.getByRole("button", { name: "Done" }), down(SHEET_DISMISS_DISTANCE + 40), 200);
    expect(sheetOpen()).toBe(false);
  });

  it("leaves a scrolled body to scroll", () => {
    render(<Harness />);
    scrollingBody(120);

    const moves = drag(screen.getByText("Melee"), down(200), 200);

    expect(sheetOpen()).toBe(true);
    expect(moves.some((move) => move.defaultPrevented)).toBe(false);
  });

  it("keeps a scroll that started upward a scroll when it turns down", () => {
    render(<Harness />);
    scrollingBody(0);

    drag(
      screen.getByText("Melee"),
      [
        [0, -20],
        [0, 60],
        [0, 200],
      ],
      200
    );

    expect(sheetOpen()).toBe(true);
  });

  it("stops the body's own scroll and rubber band while it drags", () => {
    render(<Harness />);
    scrollingBody(0);

    const moves = drag(screen.getByText("Melee"), down(40, 2), 200);

    expect(moves.every((move) => move.defaultPrevented)).toBe(true);
  });

  it.each([
    ["a field", () => screen.getByRole("textbox", { name: "Notes" })],
    ["a sideways row", () => screen.getByTestId("pills")],
    ["anything marked data-no-sheet-drag", () => screen.getByTestId("marked")],
  ])("never drags from %s", (_, target) => {
    render(<Harness />);

    drag(target(), down(SHEET_DISMISS_DISTANCE + 60), 200);

    expect(sheetOpen()).toBe(true);
  });

  it("ignores a mostly sideways swipe", () => {
    render(<Harness />);

    drag(
      screen.getByText("Rules"),
      [
        [30, 12],
        [120, 100],
        [160, 140],
      ],
      200
    );

    expect(sheetOpen()).toBe(true);
    expect(screen.getByRole("dialog").style.transform).toBe("");
  });

  it("leaves a tap a tap, and swallows the click a drag's release makes", () => {
    const onTap = vi.fn();
    render(<Harness onTap={onTap} />);
    const button = screen.getByText("Melee");

    fireEvent.touchStart(button, at(0, 400));
    fireEvent.touchMove(button, at(2, 403));
    fireEvent.touchEnd(button, at(2, 403));
    fireEvent.click(button);
    expect(onTap).toHaveBeenCalledTimes(1);

    drag(button, down(SHEET_DISMISS_DISTANCE - 30), 200);
    fireEvent.click(button);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("closes a phone's dialog too", () => {
    function PhoneDialog() {
      const [open, setOpen] = useState(true);
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Edit hero</DialogTitle>
          </DialogContent>
        </Dialog>
      );
    }
    render(<PhoneDialog />);

    drag(screen.getByText("Edit hero"), down(SHEET_DISMISS_DISTANCE + 40), 200);

    expect(sheetOpen()).toBe(false);
  });
});
