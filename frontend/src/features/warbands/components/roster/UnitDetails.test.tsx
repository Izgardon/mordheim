/**
 * An open card shows a unit's injuries in his one Boons & Banes row, each with its category's icon
 * (William, 5 Nov 2026): there is no Injuries row; a skill's box opens to its rule text.
 */
import { MemoryRouter } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { dagger, makeHero, makeItem, sword } from "@/test/warband-fixtures";
import type { WarbandHireling } from "../../types/warband-types";

import RosterSections from "./RosterSections";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

let mobile = false;
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => mobile }));

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

  it("offers Add item on an open hero, never on an open hired sword", async () => {
    // William, 21 Nov 2026: a hired sword keeps his kit; his Edit form still adds and takes away
    const grukk = { ...makeHero({ id: 3, name: "Grukk" }), kind: "hired_sword" } as WarbandHireling;
    renderWithQueryClient(
      <MemoryRouter initialEntries={["/campaigns/1/warband"]}>
        <RosterSections
          warbandId={9}
          campaign={null}
          heroes={[konrad]}
          henchmenGroups={[]}
          hirelings={[grukk]}
          canEdit
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
    await user.click(screen.getByRole("button", { name: "Open Grukk" }));
    expect(screen.queryByRole("button", { name: "Add item" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open Konrad Adler" }));
    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
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

describe("An open card's skills", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /warbands/9/template/", {
      template: null,
      variant: "",
      list_prices_open: true,
    });
  });

  // William, 5 Nov 2026: "on unit profiles, the skills dont show a description"
  it("open to their rule text, as his boons and banes do", async () => {
    const strike = { id: 7, name: "Strike to Injure", description: "Add +1 to all injury rolls." };
    renderWithQueryClient(
      <MemoryRouter initialEntries={["/campaigns/1/warband"]}>
        <RosterSections
          warbandId={9}
          campaign={null}
          heroes={[makeHero({ id: 5, name: "Konrad Adler", skills: [strike] })]}
          henchmenGroups={[]}
          hirelings={[]}
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
    await user.click(screen.getByRole("button", { name: /Strike to Injure/ }));

    expect(screen.getByText("Add +1 to all injury rolls.")).toBeInTheDocument();
  });
});

describe("An open card on a phone", () => {
  beforeEach(() => {
    mobile = true;
    fakeApi.reset();
    fakeApi.on("GET /warbands/9/template/", {
      template: null,
      variant: "",
      list_prices_open: true,
    });
  });
  afterEach(() => {
    mobile = false;
  });

  // William, 20 Nov 2026: a box's detail belongs under the boxes it was picked from, not at the
  // foot of the card: "the item under the items, the skill under the skills".
  it("opens a box's detail inside the section it was picked from", async () => {
    const strike = { id: 7, name: "Strike to Injure", description: "Add +1 to all injury rolls." };
    renderWithQueryClient(
      <MemoryRouter initialEntries={["/campaigns/1/warband"]}>
        <RosterSections
          warbandId={9}
          campaign={null}
          heroes={[makeHero({ id: 5, name: "Konrad Adler", items: [sword], skills: [strike] })]}
          henchmenGroups={[]}
          hirelings={[]}
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
    const section = (label: string) => screen.getByText(label).closest("div") as HTMLElement;
    await user.click(screen.getByRole("button", { name: "Open Konrad Adler" }));

    await user.click(screen.getByRole("button", { name: /Strike to Injure/ }));
    expect(within(section("Skills")).getByText("Add +1 to all injury rolls.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Sword/ }));
    expect(
      within(section("Items")).getByRole("button", { name: "Close rules" })
    ).toBeInTheDocument();
  });
});

describe("Selling an item from an open card", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /warbands/9/template/", {
      template: null,
      variant: "",
      list_prices_open: true,
    });
  });

  // William, 8 Nov 2026: "if you then click another item it sells that item for the prev item price"
  it("prices the item now open, not the one opened before", async () => {
    renderWithQueryClient(
      <MemoryRouter initialEntries={["/campaigns/1/warband"]}>
        <RosterSections
          warbandId={9}
          campaign={null}
          heroes={[makeHero({ id: 5, name: "Konrad Adler", items: [sword, dagger] })]}
          henchmenGroups={[]}
          hirelings={[]}
          canEdit
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

    await user.click(screen.getByRole("button", { name: /^Sword/ }));
    await user.click(screen.getByRole("button", { name: "Sell" }));
    expect(screen.getByRole("button", { name: "Sell for 10 gc" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Dagger/ }));
    expect(screen.queryByRole("button", { name: "Sell for 10 gc" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sell" }));
    expect(screen.getByRole("button", { name: "Sell for 2 gc" })).toBeInTheDocument();
  });
});

describe("An open card's items", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /warbands/9/template/", {
      template: null,
      variant: "",
      list_prices_open: true,
    });
  });

  // William, 12 Nov 2026: the gear reference carries the rules, not the fluff
  it("opens to the item's rules, not its flavour", async () => {
    const holyWater = makeItem({
      id: 103,
      name: "Holy Water",
      flavour: "Blessed in the cathedral of Sigmar before the comet fell.",
      rules: [
        {
          id: 9,
          rule_id: null,
          shared: false,
          name: "Thrown",
          summary: "",
          text: "Strength 3, no armour save.",
          table: [],
        },
      ],
    });
    renderWithQueryClient(
      <MemoryRouter initialEntries={["/campaigns/1/warband"]}>
        <RosterSections
          warbandId={9}
          campaign={null}
          heroes={[makeHero({ id: 5, name: "Konrad Adler", items: [holyWater] })]}
          henchmenGroups={[]}
          hirelings={[]}
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
    await user.click(screen.getByRole("button", { name: /^Holy Water/ }));

    expect(screen.getByText(/Strength 3, no armour save\./)).toBeInTheDocument();
    expect(screen.queryByText(/Blessed in the cathedral/)).toBeNull();
  });
});
