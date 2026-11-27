/**
 * A settings card's folded row (William, 27 Nov 2026: "more dropdowns/data concealing till
 * revealed"): closed at first, saying what it holds; a real button that says whether it is open
 * and which panel it opens; a draft kept while folded; warnings read while it is closed.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { setupUser } from "@/test/user-event";

import SettingsDisclosure, { departuresFor } from "./SettingsDisclosure";

const show = (warnings?: string[]) =>
  render(
    <SettingsDisclosure title="Features" summary="All off" warnings={warnings}>
      <input aria-label="Draft" />
    </SettingsDisclosure>
  );

describe("SettingsDisclosure", () => {
  it("is closed at first, its button naming it with what it holds", () => {
    show();

    const button = screen.getByRole("button", { name: /^Features/ });
    expect(button).toHaveTextContent("All off");
    expect(button).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(button.getAttribute("aria-controls")!);
    expect(panel).not.toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Draft" })).not.toBeInTheDocument();
  });

  it("opens to its controls, labelled by its title, and keeps a draft when folded again", async () => {
    const user = setupUser();
    show();
    const button = screen.getByRole("button", { name: /^Features/ });

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const group = screen.getByRole("group", { name: "Features" });
    expect(group).toHaveAttribute("id", button.getAttribute("aria-controls"));
    await user.type(screen.getByRole("textbox", { name: "Draft" }), "half done");

    await user.click(button);
    await user.click(button);
    expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue("half done");
  });

  it("shows its warnings while closed, and leaves them to the controls once open", async () => {
    const user = setupUser();
    show(["Mutiny in Marienburg sets Blood pacts: on."]);

    expect(screen.getByText("Mutiny in Marienburg sets Blood pacts: on.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^Features/ }));
    expect(
      screen.queryByText("Mutiny in Marienburg sets Blood pacts: on.")
    ).not.toBeInTheDocument();
  });
});

describe("departuresFor", () => {
  it("gives the server's warnings for the section's own fields, in its order", () => {
    const departures = new Map([
      ["max_heroes", "Sets Most heroes: 6."],
      ["enable_locations", "Sets Trade locations: on."],
    ]);

    expect(departuresFor(departures, ["enable_locations", "enable_encampments"])).toEqual([
      "Sets Trade locations: on.",
    ]);
  });
});
