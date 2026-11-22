/**
 * Add to basket (William, 22 Nov 2026): one full-width button for the unit the store was opened
 * for; in the warband's store, a dropdown of who gets it (the stash first, the heroes, the
 * henchmen groups with what their copies come to) and the button.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";

import AddToBasket from "./AddToBasket";
import type { Recipient } from "./useStoreBasket";

const recipients = [
  { key: "stash", label: "Stash", target: { kind: "stash" }, count: 1 },
  { key: "heroes:5", label: "Aldric", target: { kind: "heroes" }, count: 1 },
  { key: "henchmen:8", label: "Swordsmen", target: { kind: "henchmen" }, count: 4 },
] as Recipient[];

function show(firstKey: string | null, more: { enabled?: boolean } = {}) {
  const onAdd = vi.fn();
  render(
    <AddToBasket
      recipients={recipients}
      firstKey={firstKey}
      each={20}
      free={false}
      isMobile={false}
      enabled={more.enabled ?? true}
      onAdd={onAdd}
    />
  );
  return onAdd;
}

describe("AddToBasket", () => {
  it("is one button for the unit the store was opened for", async () => {
    const user = setupUser();
    const onAdd = show("henchmen:8");

    expect(screen.queryByRole("combobox")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add to basket · 80 gc" }));

    expect(onAdd).toHaveBeenCalledWith(recipients[2]);
  });

  it("starts on the stash in the warband's store", async () => {
    const user = setupUser();
    const onAdd = show(null);

    expect(screen.getByRole("combobox", { name: "Who gets it" })).toHaveTextContent("Stash");
    await user.click(screen.getByRole("button", { name: "Add to basket · 20 gc" }));

    expect(onAdd).toHaveBeenCalledWith(recipients[0]);
  });

  it("sections the units and gives a group what its members' copies come to", async () => {
    const user = setupUser();
    const onAdd = show(null);
    const who = screen.getByRole("combobox", { name: "Who gets it" });

    await user.click(who);
    const list = screen.getByRole("listbox");
    expect(within(list).getByText("Heroes")).toBeInTheDocument();
    expect(within(list).getByText("Henchmen")).toBeInTheDocument();
    expect(within(list).getByRole("option", { name: /Swordsmen/ })).toHaveTextContent(
      "×4 models · 80 gc"
    );
    await user.keyboard("{Escape}");
    await pickOption(user, who, /Swordsmen/);
    await user.click(screen.getByRole("button", { name: "Add to basket · 80 gc" }));

    expect(onAdd).toHaveBeenCalledWith(recipients[2]);
  });

  it("waits while the item can't go in yet", () => {
    show(null, { enabled: false });
    expect(screen.getByRole("button", { name: /Add to basket/ })).toBeDisabled();
  });
});
