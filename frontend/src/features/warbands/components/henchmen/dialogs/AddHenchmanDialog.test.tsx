import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AddHenchmanDialog from "./AddHenchmanDialog";
import { henchmenKind } from "../../../units/kinds/henchmen";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

// Three members, Clubs and Daggers three each, price 25, XP 4: the client's figure is 38.
const renderDialog = (
  form = henchmenKind.mapToForm(makeVeteranHenchmenGroup({ hire_cost: 50 }))
) => {
  const onConfirm = vi.fn();
  renderWithQueryClient(
    <AddHenchmanDialog
      open
      onOpenChange={vi.fn()}
      group={form}
      stashQtyById={{}}
      onConfirm={onConfirm}
    />
  );
  return onConfirm;
};

describe("AddHenchmanDialog cost (decision 7)", () => {
  it("defaults to the server's hire_cost, less the items not bought", async () => {
    const user = setupUser();
    const onConfirm = renderDialog();

    expect(screen.getByRole("button", { name: "Add Henchman — 50 gc" })).toBeInTheDocument();
    // The first row is a Dagger (2 gc).
    await user.click(screen.getAllByRole("button", { name: "Ignore" })[0]);
    await user.type(screen.getByPlaceholderText("Henchman name"), "Blade Four");
    await user.click(screen.getByRole("button", { name: "Add Henchman — 48 gc" }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Blade Four", cost: 48 })
    );
  });

  it("works the cost out itself once the form's XP no longer matches what the server priced", () => {
    const form = henchmenKind.mapToForm(makeVeteranHenchmenGroup({ hire_cost: 50 }));
    renderDialog({ ...form, xp: "6" });

    // 25 + 3 + 2 + 2 x 6.
    expect(screen.getByRole("button", { name: "Add Henchman — 42 gc" })).toBeInTheDocument();
  });
});
