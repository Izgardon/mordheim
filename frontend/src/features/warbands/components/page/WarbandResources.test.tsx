/**
 * The warband's resources: the campaign's default resource comes first, with no icon, then its
 * campaign points; their ⋮ offers only Sell (the campaign names them, and they are never deleted);
 * the rest keep Rename, Sell and Delete, and a Wyrdstone-named one keeps its icon. Add resource
 * takes a name only.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { WarbandResource } from "../../types/warband-types";
import WarbandResources from "./WarbandResources";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

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

describe("Add resource", () => {
  beforeEach(() => fakeApi.reset());

  // William, 7 Nov 2026: "add resource should just be name not amount"
  it("asks only for a name, and the new resource starts at 0", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/resources/", (body: { name: string }) => resource(7, body.name));
    renderResources();

    await user.click(screen.getByRole("button", { name: "Add resource" }));
    const form = screen.getByRole("form", { name: "Add resource" });
    expect(
      within(form)
        .getAllByRole("textbox")
        .map((field) => field.getAttribute("aria-label"))
    ).toEqual(["Resource name"]);
    expect(within(form).queryByRole("spinbutton")).toBeNull();
    await user.type(within(form).getByLabelText("Resource name"), " Amber ");
    await user.click(within(form).getByRole("button", { name: "Add" }));

    await waitFor(() => expect(screen.queryByRole("form", { name: "Add resource" })).toBeNull());
    expect(fakeApi.calls()).toEqual(["POST /warbands/9/resources/"]);
    expect(fakeApi.bodyOf("POST /warbands/9/resources/")).toEqual({ name: "Amber" });
  });
});
