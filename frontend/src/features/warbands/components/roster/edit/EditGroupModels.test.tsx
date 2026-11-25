/**
 * A group's models in its Edit form (William, 25 Nov 2026): a saved model's Remove is Dismiss,
 * which asks where his share goes, and beside it his own Missing games, saved with the group's
 * members; the group has no Missing games of its own.
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

import EditUnitForm from "../EditUnitForm";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("../../../api/warband-cache", () => ({ useWarbandCacheUpdate: () => () => undefined }));

type Batch = { update: Record<string, unknown>[] };
const BATCH = "POST /warbands/9/henchmen-groups/batch/";

const renderGroup = () =>
  renderWithQueryClient(
    <EditUnitForm
      entry={{ kind: "henchmen_group", unit: makeVeteranHenchmenGroup() }}
      campaign={null}
      campaignId={1}
      warbandId={9}
      canCreateRace={false}
      onAddItem={vi.fn()}
      onClose={vi.fn()}
    />
  );

describe("A group's models in the Edit form", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on(BATCH, { units: [], summary: {} });
  });

  it("dismiss a saved model, asking where his share goes", async () => {
    const user = setupUser();
    renderGroup();

    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
    await user.click(screen.getByRole("button", { name: "To the stash" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const members = (fakeApi.bodyOf(BATCH) as Batch).update[0].henchmen as Record<
      string,
      unknown
    >[];
    expect(members).toContainEqual({ id: 61, dismiss: "stash" });
    expect(members.map((member) => member.id)).toEqual([62, 63, 61]);
  });

  it("set one model's missing games, and the group none of its own", async () => {
    const user = setupUser();
    renderGroup();

    expect(screen.queryByRole("button", { name: "Missing games" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Missing games of model 2" }));
    const games = screen.getByRole("spinbutton", { name: "Model 2: missing games" });
    await user.clear(games);
    await user.type(games, "2");
    await user.type(screen.getByRole("textbox", { name: "Model 2: why" }), "Captured");
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Missing games of model 2" })).toHaveTextContent(
      "Missing · 2 games"
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    const update = (fakeApi.bodyOf(BATCH) as Batch).update[0];
    expect(update).not.toHaveProperty("missing_games");
    expect(update.henchmen).toEqual([
      expect.objectContaining({ id: 61, missing_games: 0, missing_reason: "" }),
      expect.objectContaining({ id: 62, missing_games: 2, missing_reason: "Captured" }),
      expect.objectContaining({ id: 63, missing_games: 0, missing_reason: "" }),
    ]);
  });
});
