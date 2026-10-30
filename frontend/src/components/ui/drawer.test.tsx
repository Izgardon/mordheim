import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Drawer } from "./drawer";

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <Drawer open={open} onOpenChange={setOpen} kicker="Store" title="Buy wargear" actions="85 gc">
      <p>Sword, 10 gc</p>
    </Drawer>
  );
}

describe("Drawer", () => {
  it("is a dialog named by its title, with the kicker, actions and body", () => {
    render(<Harness />);

    const drawer = screen.getByRole("dialog", { name: "Buy wargear" });
    expect(drawer).toHaveTextContent("Store");
    expect(drawer).toHaveTextContent("85 gc");
    expect(drawer).toHaveTextContent("Sword, 10 gc");
  });

  it("closes from its close button", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
