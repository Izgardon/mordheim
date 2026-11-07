import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { useFloating } from "./floating";
import { SearchCombobox } from "./search-combobox";
import { setupUser } from "@/test/user-event";

/** A field 300 px wide and 36 tall at `top` in the 768 px window jsdom has. */
const fieldAt = (top: number) => () =>
  ({
    top,
    bottom: top + 36,
    left: 40,
    right: 340,
    width: 300,
    height: 36,
    x: 40,
    y: top,
  }) as DOMRect;

function Field({ top }: { top: number }) {
  const floating = useFloating(true);
  return (
    <div>
      <div
        ref={(node) => {
          if (node) node.getBoundingClientRect = fieldAt(top);
          floating.anchorRef.current = node;
        }}
      />
      {floating.origin}
      <ul data-testid="list" style={floating.style} />
    </div>
  );
}

describe("useFloating", () => {
  it("opens a list fixed under its field, as wide as it", () => {
    render(<Field top={100} />);

    const list = screen.getByTestId("list");
    expect(list.style.position).toBe("fixed");
    expect([list.style.top, list.style.left, list.style.width]).toEqual(["136px", "40px", "300px"]);
    expect([list.style.maxHeight, list.style.transform]).toEqual(["288px", ""]);
  });

  it("opens it over the field when the window has no room below", () => {
    render(<Field top={700} />);

    const list = screen.getByTestId("list");
    expect([list.style.top, list.style.transform]).toEqual(["700px", "translateY(-100%)"]);
  });
});

describe("a search's list in a modal", () => {
  it("floats out of the modal's scrolling body, staying inside the modal for focus", async () => {
    const user = setupUser();
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Add item</DialogTitle>
          <SearchCombobox label="Race" options={[{ id: 1, title: "Human" }]} onPick={() => {}} />
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByRole("combobox", { name: "Race" }));
    const list = screen.getByRole("listbox", { name: "Race" });
    expect(list.style.position).toBe("fixed");
    expect(screen.getByRole("dialog")).toContainElement(list);
    expect(screen.getByRole("combobox", { name: "Race" })).toHaveFocus();
  });
});
