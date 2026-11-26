/**
 * Camp's Recruit henchmen for a new group: the group needs a name (William, 26 Nov 2026: "Block
 * it, needs a name"), said under the field before anything is sent; recruits into a group the
 * warband has already take its name.
 */
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { OpenCamp } from "./camp-types";
import VeteransDialog from "./VeteransDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("../../api/warband-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/warband-cache")>()),
  useWarbandCacheUpdate: () => () => undefined,
}));

const BATCH = "POST /warbands/9/henchmen-groups/batch/";

function show() {
  const save = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const camp = {
    campaignId: 1,
    warbandId: 9,
    gold: 100,
    groups: [],
    draft: { unit_results: {}, camp: { veterans: { dice: [3, 4], spent: 0 } } },
    save,
  } as unknown as OpenCamp;
  renderWithQueryClient(
    <MemoryRouter>
      <VeteransDialog camp={camp} open onClose={onClose} />
    </MemoryRouter>
  );
  return { save, onClose };
}

describe("Camp's Recruit henchmen", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /warbands/9/template/", {
      template: null,
      variant: "",
      list_prices_open: false,
    });
    fakeApi.on(BATCH, { units: [{ id: 4 }], summary: {}, warnings: [] });
  });

  it("won't recruit a new group without a name", async () => {
    const { onClose } = show();
    const user = setupUser();

    await user.click(await screen.findByRole("button", { name: "Recruit" }));
    expect(screen.getByText("Name is needed.")).toBeInTheDocument();
    expect(screen.getByLabelText("Group name")).toHaveFocus();
    expect(fakeApi.countOf(BATCH)).toBe(0);

    await user.type(screen.getByLabelText("Group name"), "Bravos");
    expect(screen.queryByText("Name is needed.")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Recruit" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fakeApi.bodyOf(BATCH)).toMatchObject({
      create: [
        { name: "Bravos", race: null, henchmen: [{ name: "Recruit 1" }, { name: "Recruit 2" }] },
      ],
    });
  });
});
