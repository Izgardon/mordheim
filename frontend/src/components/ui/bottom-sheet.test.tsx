import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { fakeVisualViewport } from "@/test/visual-viewport";

import { BottomSheet } from "./bottom-sheet";
import { SHEET_DISMISS_MIN } from "./use-sheet-drag";

function Harness({ onOpenChange = vi.fn() }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        setOpen(next);
      }}
      kicker="Battle 5"
      title="Battle menu"
      footer={<button type="button">Done</button>}
    >
      <p>Chat</p>
    </BottomSheet>
  );
}

const drag = (distance: number) => {
  const handle = screen.getByTestId("sheet-handle");
  fireEvent.pointerDown(handle, { clientY: 400, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientY: 400 + distance, pointerId: 1 });
  fireEvent.pointerUp(handle, { clientY: 400 + distance, pointerId: 1 });
};

// jsdom has no PointerEvent, so fireEvent.pointer* would drop clientY; a MouseEvent carries it.
const original = window.PointerEvent;
beforeAll(() => {
  if (!original) {
    window.PointerEvent = class extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    } as unknown as typeof PointerEvent;
  }
});
afterAll(() => {
  window.PointerEvent = original;
});

describe("BottomSheet", () => {
  it("is a dialog named by its title, with the kicker, body and footer", () => {
    render(<Harness />);

    const sheet = screen.getByRole("dialog", { name: "Battle menu" });
    expect(sheet).toHaveTextContent("Battle 5");
    expect(sheet).toHaveTextContent("Chat");
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("closes when the handle is dragged down far enough, and stays for a short drag", () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);

    drag(SHEET_DISMISS_MIN - 10);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    drag(SHEET_DISMISS_MIN + 10);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("may fill the screen but for the status bar, the handle and × still on it", () => {
    render(<Harness />);

    const sheet = screen.getByRole("dialog", { name: "Battle menu" });
    expect(sheet.className).toContain("max-h-[calc(100dvh-env(safe-area-inset-top,0px))]");
    expect(screen.getByTestId("sheet-handle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("closes from its close button", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// William, 26 Nov 2026: "When keyboard is out I can't scroll to bottom of screen, it just covers it"
describe("The sheet with the keyboard up", () => {
  it("sits on the keyboard and shrinks to what it leaves, then goes back", () => {
    const viewport = fakeVisualViewport(800);
    render(<Harness />);
    const sheet = screen.getByRole("dialog", { name: "Battle menu" });
    expect(sheet.style.bottom).toBe("");

    act(() => viewport.keyboard(350));
    expect(sheet.style.bottom).toBe("350px");
    expect(sheet.style.maxHeight).toBe("calc(450px - env(safe-area-inset-top, 0px))");

    act(() => viewport.keyboard(0));
    expect(sheet.style.bottom).toBe("");
    viewport.restore();
  });
});
