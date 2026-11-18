/**
 * The web dialog's footer (William, 12 Nov 2026, on the modal buttons: "yes, sticky to the bottom
 * where it makes sense"). The dialog scrolls its header, body and footer in one column, so a long
 * form scrolled its buttons out of sight; the phone's bottom sheet already keeps its footer below
 * the scrolling body.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

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
