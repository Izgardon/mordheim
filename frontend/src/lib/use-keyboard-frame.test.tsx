import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeVisualViewport } from "@/test/visual-viewport";

import { keyboardSheetStyle, useKeyboardFrame } from "./use-keyboard-frame";

function Probe({ active = true }: { active?: boolean }) {
  const frame = useKeyboardFrame(active);
  return (
    <>
      <input aria-label="Name" />
      <output>{frame ? `${frame.height} above ${frame.bottom}` : "no keyboard"}</output>
    </>
  );
}

let viewport: ReturnType<typeof fakeVisualViewport>;

describe("useKeyboardFrame", () => {
  beforeEach(() => {
    viewport = fakeVisualViewport(800);
  });
  afterEach(() => {
    viewport.restore();
    vi.restoreAllMocks();
  });

  it("follows the keyboard up and down", () => {
    render(<Probe />);
    expect(screen.getByRole("status")).toHaveTextContent("no keyboard");

    act(() => viewport.keyboard(350));
    expect(screen.getByRole("status")).toHaveTextContent("450 above 350");

    // iOS scrolls the view to the focused field: the keyboard's top is where the view ends
    act(() => viewport.keyboard(350, 120));
    expect(screen.getByRole("status")).toHaveTextContent("450 above 230");

    act(() => viewport.keyboard(0));
    expect(screen.getByRole("status")).toHaveTextContent("no keyboard");
  });

  it("reads a pinch zoom as no keyboard", () => {
    render(<Probe />);
    act(() => viewport.zoom(2));
    expect(screen.getByRole("status")).toHaveTextContent("no keyboard");
  });

  it("reads nothing while not active", () => {
    render(<Probe active={false} />);
    act(() => viewport.keyboard(350));
    expect(screen.getByRole("status")).toHaveTextContent("no keyboard");
  });

  it("scrolls the focused field back into view as the keyboard comes up", () => {
    const scrolled = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrolled;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((step) => {
      step(0);
      return 1;
    });
    render(<Probe />);
    screen.getByLabelText("Name").focus();

    act(() => viewport.keyboard(350));
    expect(scrolled).toHaveBeenCalledWith({ block: "nearest" });
  });
});

describe("keyboardSheetStyle", () => {
  it("sits the sheet on the keyboard, as tall as what it leaves less the status bar", () => {
    expect(keyboardSheetStyle({ height: 450, bottom: 350 })).toEqual({
      bottom: "350px",
      maxHeight: "calc(450px - env(safe-area-inset-top, 0px))",
    });
    expect(keyboardSheetStyle(null)).toBeUndefined();
  });
});
