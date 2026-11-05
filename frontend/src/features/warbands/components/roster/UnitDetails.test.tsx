/**
 * An open card shows a unit's injuries in his one Boons & Banes row, each with its category's icon
 * (William, 5 Nov 2026): there is no Injuries row.
 */
import { MemoryRouter } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeHero } from "@/test/warband-fixtures";

import RosterSections from "./RosterSections";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const konrad = makeHero({
  id: 5,
  name: "Konrad Adler",
  specials: [
    { id: 1, name: "Hatred", type: "Psychology", kind: "boon", category: "aura" },
    { id: 2, name: "Old Battle Wound", type: "Injury", kind: "bane", category: "injury" },
    { id: 3, name: "Large", type: "Trait", kind: "trait", category: "body" },
  ],
});

describe("An open card's Boons & Banes", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /warbands/9/template/", {
      template: null,
      variant: "",
      list_prices_open: true,
    });
  });

  it("lists his injuries with his other boons and banes", async () => {
    renderWithQueryClient(
      <MemoryRouter initialEntries={["/campaigns/1/warband"]}>
        <RosterSections
          warbandId={9}
          campaign={null}
          heroes={[konrad]}
          henchmenGroups={[]}
          hirelings={[]}
          resources={[]}
          canEdit={false}
          canCreateRace={false}
          onLoadout={vi.fn()}
          onHire={vi.fn()}
          onAdvance={vi.fn()}
          onBuyAgain={vi.fn()}
          renderEdit={() => null}
        />
      </MemoryRouter>
    );
    const user = setupUser();
    await user.click(screen.getByRole("button", { name: "Open Konrad Adler" }));

    const row = screen.getByText("Boons & Banes").closest("div") as HTMLElement;
    expect(
      within(row)
        .getAllByRole("button")
        .map((box) => box.textContent)
    ).toEqual(["HatredPsychology", "Old Battle WoundInjury", "LargeTrait"]);
    expect(screen.queryByText("Injuries")).not.toBeInTheDocument();
  });
});
