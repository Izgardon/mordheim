/** Add a neutral group: its name alone (William, 25 Nov 2026: "name only, then add"). */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { setupUser } from "@/test/user-event";

import AddNeutralGroupSheet from "./AddNeutralGroupSheet";

function show() {
  const onAdd = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  render(<AddNeutralGroupSheet open onOpenChange={onOpenChange} onAdd={onAdd} />);
  return { onAdd, onOpenChange };
}

describe("Add a neutral group", () => {
  it("asks only for a name", async () => {
    const user = setupUser();
    const { onAdd, onOpenChange } = show();

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByLabelText("How many")).toBeNull();
    await user.type(screen.getByLabelText("Group name"), "  The Restless Dead ");
    await user.click(screen.getByRole("button", { name: "Add the group" }));

    expect(onAdd).toHaveBeenCalledWith("The Restless Dead");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("wants a name", async () => {
    const user = setupUser();
    const { onAdd } = show();

    await user.click(screen.getByRole("button", { name: "Add the group" }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByText("Give the group a name.")).toBeInTheDocument();
  });
});
