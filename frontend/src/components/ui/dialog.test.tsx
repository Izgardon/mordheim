/**
 * The web dialog's footer (William, 12 Nov 2026, on the modal buttons: "yes, sticky to the bottom
 * where it makes sense"). The dialog scrolls its header, body and footer in one column, so a long
 * form scrolled its buttons out of sight; the phone's bottom sheet already keeps its footer below
 * the scrolling body.
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeVisualViewport } from "@/test/visual-viewport";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

const media = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => media.mobile }));

function open(body: string) {
  render(
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit rule</DialogTitle>
        </DialogHeader>
        <p>{body}</p>
        <DialogFooter>
          <button type="button">Cancel</button>
          <button type="button">Save</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return screen.getByRole("button", { name: "Save" }).parentElement as HTMLElement;
}

describe("a dialog on a phone", () => {
  beforeEach(() => {
    media.mobile = true;
  });
  afterEach(() => {
    media.mobile = false;
  });

  it("may fill the screen but for the status bar, as a bottom sheet may", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rating breakdown</DialogTitle>
          </DialogHeader>
          <p>A long list of units.</p>
        </DialogContent>
      </Dialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Rating breakdown" });
    expect(dialog.className).toContain("max-h-[calc(100dvh-env(safe-area-inset-top,0px))]");
    expect(dialog.className).not.toContain("max-h-[85dvh]");
    // nor an inline cap of 85% of the screen over it, as it had (William, 20 Nov 2026)
    expect(dialog.style.maxHeight).toBe("");
  });

  it("sits on the keyboard while it is up, as tall as what it leaves", () => {
    const viewport = fakeVisualViewport(800);
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Edit hero</DialogTitle>
          <input aria-label="Name" />
        </DialogContent>
      </Dialog>
    );
    const dialog = screen.getByRole("dialog", { name: "Edit hero" });

    act(() => viewport.keyboard(320));
    expect(dialog.style.bottom).toBe("320px");
    expect(dialog.style.maxHeight).toBe("calc(480px - env(safe-area-inset-top, 0px))");
    viewport.restore();
  });
});

describe("DialogFooter", () => {
  it("sticks to the bottom of the scrolling body", () => {
    const footer = open("A long rule.");

    expect(footer).toHaveClass("sticky");
    expect(footer).toHaveClass("bottom-0");
    // it spans the body's side gutter, so the content passes under it, not beside it
    expect(footer).toHaveClass("-mx-4");
    expect(footer).toHaveClass("bg-panel");
  });

  it("still scrolls inside the body, which the footer sits at the foot of", () => {
    const footer = open("Short.");
    const body = footer.parentElement as HTMLElement;

    expect(body).toHaveClass("overflow-y-auto");
    expect(body.lastElementChild).toBe(footer);
  });
});
