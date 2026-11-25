/**
 * An open group's member rows (William, 25 Nov 2026): no Dismiss (the edit form dismisses), a
 * member missing games marked as a missing hero is, and a creature group's Send back to stash,
 * which turns that one member back into the creature's item in the stash.
 */
import { MemoryRouter } from "react-router-dom";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeVeteranHenchmenGroup } from "@/test/warband-fixtures";
import type { HenchmenGroup } from "../../types/warband-types";

import GroupMembers from "./GroupMembers";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("../../api/warband-cache", () => ({ useWarbandCacheUpdate: () => () => undefined }));

const renderMembers = (group: HenchmenGroup) =>
  renderWithQueryClient(
    <MemoryRouter>
      <GroupMembers group={group} campaignId={1} warbandId={9} canEdit />
    </MemoryRouter>
  );

describe("An open group's member rows", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /warbands/9/stash/", []);
    fakeApi.on("POST /warbands/9/henchmen-groups/21/back-to-item/", {
      group: null,
      stash_items: [],
      summary: {},
    });
  });

  it("offer no Dismiss and mark a member who misses games", () => {
    const group = makeVeteranHenchmenGroup();
    group.henchmen[1] = { ...group.henchmen[1], missing_games: 1, missing_reason: "Captured" };
    renderMembers(group);

    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Missing · 1 game")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Send back to stash" })).not.toBeInTheDocument();
  });

  it("send one creature back to the stash as its item", async () => {
    const user = setupUser();
    renderMembers(makeVeteranHenchmenGroup({ source_beast_id: 4, beast_kind: "creature" }));

    const buttons = screen.getAllByRole("button", { name: "Send back to stash" });
    expect(buttons).toHaveLength(3);
    await user.click(buttons[1]);

    expect(fakeApi.bodyOf("POST /warbands/9/henchmen-groups/21/back-to-item/")).toEqual({
      member_ids: [62],
    });
  });
});
