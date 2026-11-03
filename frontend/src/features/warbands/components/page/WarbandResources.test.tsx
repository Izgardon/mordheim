/**
 * The warband's resources: the campaign's default resource comes first, with no icon, and its ⋮
 * offers only Sell (the campaign renames it, and it is never deleted); the rest keep Rename,
 * Sell and Delete, and a Wyrdstone-named one keeps its icon.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { WarbandResource } from "../../types/warband-types";
import WarbandResources from "./WarbandResources";

const resource = (id: number, name: string, is_default = false): WarbandResource => ({
  id,
  warband_id: 9,
  name,
  amount: id,
  is_default,
});

const resources = [
  resource(1, "Amber"),
  resource(2, "Wyrdstone shards"),
  resource(3, "Warpstone", true),
];

const renderResources = (canEdit = true) =>
  renderWithQueryClient(<WarbandResources warbandId={9} resources={resources} canEdit={canEdit} />);

describe("WarbandResources", () => {
  it("lists the default resource first, with no icon", () => {
    renderResources(false);

    const names = within(screen.getByRole("region", { name: "Resources" }))
      .getAllByText(/^(Amber|Wyrdstone shards|Warpstone)$/)
      .map((label) => label.textContent);
    expect(names).toEqual(["Warpstone", "Amber", "Wyrdstone shards"]);
    expect(screen.getByText("Warpstone").querySelector("svg")).toBeNull();
    expect(screen.getByText("Wyrdstone shards").querySelector("svg")).not.toBeNull();
  });

  it("offers only Sell on the default resource", async () => {
    const user = setupUser();
    renderResources();

    await user.click(screen.getByRole("button", { name: "Warpstone actions" }));

    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Sell"]);
  });

  it("keeps Rename, Sell and Delete on the others", async () => {
    const user = setupUser();
    renderResources();

    await user.click(screen.getByRole("button", { name: "Amber actions" }));

    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Rename", "Sell", "Delete"]);
  });
});
