import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FoundPlace } from "@/features/exploration/utils/places-found";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import PlaceRollPanel from "./PlaceRollPanel";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/stores/app-store", () => ({ useAppStore: () => ({ warband: null }) }));

const isle: FoundPlace = {
  kicker: "Doubles 6·6",
  face: 6,
  count: 2,
  place: {
    id: 6,
    face: 6,
    name: "Private Isle",
    rules: "Roll a D6 for each entry:\nCorpse 2+\nD6x5 gold crowns 3+",
  },
} as FoundPlace;

beforeEach(() => {
  fakeApi.reset();
});

describe("PlaceRollPanel", () => {
  it("holds the place's text above the dice roller, both on screen at once", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <PlaceRollPanel campaignId={1} found={isle} open onOpenChange={() => undefined} />
    );
    const panel = screen.getByRole("dialog", { name: "Private Isle" });
    expect(within(panel).getByText("Doubles 6·6")).toBeInTheDocument();
    expect(within(panel).getByText(/Corpse 2\+/)).toBeInTheDocument();
    expect(within(panel).getByRole("group", { name: "Die" })).toBeInTheDocument();
    // the rolls are logged for the place
    expect(within(panel).getByRole("textbox", { name: "What for" })).toHaveValue("Private Isle");

    // the table's roll typed in, as the top bar's roller takes it
    await user.type(within(panel).getByRole("textbox", { name: "First D6 rolled" }), "4");
    await user.type(within(panel).getByRole("textbox", { name: "Second D6 rolled" }), "6");
    expect(await within(panel).findByText("10")).toBeInTheDocument();
    expect(within(panel).getByText(/Corpse 2\+/)).toBeInTheDocument();
  });

  it("shows nothing while closed", () => {
    renderWithQueryClient(
      <PlaceRollPanel campaignId={1} found={isle} open={false} onOpenChange={() => undefined} />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
