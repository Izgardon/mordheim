/**
 * The shared race field: the race on a searchable select, and the plus that opens the new-race
 * form. On a phone the field sits in a two-column grid, so Add new is the plus alone (William,
 * 18 Nov 2026: "Race section is looking bad here, we dont need the text for add new just the
 * plus should be fine") and nothing in the field runs over what sits beside it.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { catalogueListKey } from "@/lib/catalogue-queries";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import RaceField from "./RaceField";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const HUMAN = {
  id: 1,
  campaign_id: null,
  name: "Human",
  movement: 4,
  weapon_skill: 6,
  ballistic_skill: 6,
  strength: 4,
  toughness: 4,
  wounds: 3,
  initiative: 6,
  attacks: 4,
  leadership: 9,
};

const show = (value: number | null = HUMAN.id, canCreate = true) => {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(catalogueListKey(3, "races"), [HUMAN]);
  renderWithQueryClient(
    <RaceField campaignId={3} value={value} canCreate={canCreate} onChange={vi.fn()} />,
    { queryClient }
  );
};

beforeEach(() => fakeApi.reset());

describe("the race field", () => {
  it("offers the new race behind the plus alone, named for a screen reader", () => {
    show();

    const plus = screen.getByRole("button", { name: "Add a new race" });
    expect(plus).toHaveAttribute("title", "Add a new race");
    expect(plus).toHaveTextContent("");
    expect(screen.queryByText("Add new")).not.toBeInTheDocument();
  });

  it("opens the new-race form from the plus", async () => {
    const user = setupUser();
    show();

    await user.click(screen.getByRole("button", { name: "Add a new race" }));

    const form = screen.getByRole("group", { name: "New race" });
    expect(within(form).getByRole("textbox", { name: "Race name" })).toBeInTheDocument();
  });

  it("keeps the race picked inside the field, cut short rather than overflowing it", () => {
    show();

    // in the unit's Edit the field is half a phone's width: the name is cut short inside it
    // instead of running over the clear and the plus beside it (William, 18 Nov 2026)
    const field = screen.getByRole("button", { name: "Race: Human" });
    expect(within(field).getByText("Human")).toHaveClass("truncate", "min-w-0");
  });

  it("has no plus for a player who can't add a race", () => {
    show(HUMAN.id, false);

    expect(screen.queryByRole("button", { name: "Add a new race" })).not.toBeInTheDocument();
  });
});
