/**
 * The warband's resources: the campaign's default resource comes first, with no icon, then its
 * campaign points; their ⋮ offers only Sell (the campaign names them, and they are never deleted);
 * the rest keep Rename, Sell and Delete, and a Wyrdstone-named one keeps its icon.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { WarbandResource } from "../../types/warband-types";
import WarbandResources from "./WarbandResources";

const resource = (
  id: number,
  name: string,
  is_default = false,
  is_campaign_points = false
): WarbandResource => ({
  id,
  warband_id: 9,
  name,
  amount: id,
  is_default,
  is_campaign_points,
});

const resources = [
  resource(1, "Amber"),
  resource(4, "Campaign points", false, true),
  resource(2, "Wyrdstone shards"),
  resource(3, "Warpstone", true),
];

const renderResources = (canEdit = true) =>
  renderWithQueryClient(<WarbandResources warbandId={9} resources={resources} canEdit={canEdit} />);

describe("WarbandResources", () => {
  it("lists the default resource first, with no icon, then campaign points", () => {
    renderResources(false);

    const names = within(screen.getByRole("region", { name: "Resources" }))
      .getAllByText(/^(Amber|Wyrdstone shards|Warpstone|Campaign points)$/)
      .map((label) => label.textContent);
    expect(names).toEqual(["Warpstone", "Campaign points", "Amber", "Wyrdstone shards"]);
    expect(screen.getByText("Warpstone").querySelector("svg")).toBeNull();
    expect(screen.getByText("Wyrdstone shards").querySelector("svg")).not.toBeNull();
  });

  it("offers only Sell on the default resource and on campaign points", async () => {
    const user = setupUser();
    renderResources();

    for (const name of ["Warpstone", "Campaign points"]) {
      await user.click(screen.getByRole("button", { name: `${name} actions` }));
      const items = await screen.findAllByRole("menuitem");
      expect(items.map((item) => item.textContent)).toEqual(["Sell"]);
      await user.keyboard("{Escape}");
    }
  });

  it("keeps Rename, Sell and Delete on the others", async () => {
    const user = setupUser();
    renderResources();

    await user.click(screen.getByRole("button", { name: "Amber actions" }));

    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Rename", "Sell", "Delete"]);
  });
});
