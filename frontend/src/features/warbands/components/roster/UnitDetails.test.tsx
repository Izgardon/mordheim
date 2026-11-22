/**
 * An open card shows a unit's injuries in his one Boons & Banes row, each with its category's icon
 * (William, 5 Nov 2026): there is no Injuries row; a skill's box opens to its rule text.
 */
import { MemoryRouter } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { skillGroup, spell } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import {
  dagger,
  makeHero,
  makeItem,
  makeVeteranHenchmenGroup,
  sword,
} from "@/test/warband-fixtures";
import type { WarbandHireling } from "../../types/warband-types";

import RosterSections from "./RosterSections";
import UnitDetails from "./UnitDetails";
import type { RosterUnit } from "./unit-view";

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

describe("An open card's animals", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /warbands/9/template/", {
      template: null,
      variant: "",
      list_prices_open: true,
    });
  });

  // William, 22 Nov 2026: "Polecat doesn't show details on unit card when clicked": most beasts'
  // rules are their bestiary entry's specials, not item rules
  it("opens to the beast's profile and specials", async () => {
    const beast = {
      id: 4,
      name: "Polecat",
      kind: "pet" as const,
      has_profile: true,
      movement: 6,
      weapon_skill: 3,
      ballistic_skill: 0,
      strength: 2,
      toughness: 2,
      wounds: 1,
      initiative: 4,
      attacks: 1,
      leadership: 4,
      armour_save: null,
      specials: [{ id: 8, name: "Cat Friend (Polecat)", description: "Hates the warband's cats." }],
    };
    const polecat = makeItem({ id: 104, name: "Polecat", type: "Animal", bestiary_entry: beast });
    renderWithQueryClient(
      <MemoryRouter initialEntries={["/campaigns/1/warband"]}>
        <RosterSections
          warbandId={9}
          campaign={null}
          heroes={[makeHero({ id: 5, name: "Konrad Adler", items: [polecat] })]}
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
    await user.click(screen.getByRole("button", { name: /^Polecat/ }));

    const panel = screen
      .getByRole("button", { name: "Close rules" })
      .closest(".bg-panel") as HTMLElement;
    expect(within(panel).getByText("Cat Friend (Polecat)")).toBeInTheDocument();
    expect(within(panel).getByText(/Hates the warband's cats\./)).toBeInTheDocument();
    expect(within(panel).getByText("WS")).toBeInTheDocument();
  });
});

describe("An open card's boxes", () => {
  const aldric: RosterUnit = {
    kind: "hero",
    unit: makeHero({
      id: 5,
      name: "Aldric Voss",
      available_skills: ["Combat"],
      items: [
        makeItem({ id: 101, name: "Sword", type: "Weapon", subtype: "Melee", strength: "As user" }),
        makeItem({ id: 105, name: "Buckler", type: "Armour", subtype: "Shield", save: "6+" }),
      ],
      skills: [{ id: 7, name: "Strike to Injure", description: "" }],
      spells: [spell({ id: 301, name: "Fires of U'Zhul", type: "Lesser Magic", dc: 7 })],
      specials: [
        { id: 2, name: "Old Battle Wound", type: "Injury", kind: "bane", category: "injury" },
      ],
    }),
  };
  const renderDetails = () =>
    renderWithQueryClient(
      <MemoryRouter>
        <UnitDetails
          entry={aldric}
          campaign={{ id: 1 } as CampaignSummary}
          canEdit
          others={[]}
          onXp={vi.fn()}
          onMoveItem={vi.fn()}
          onSellItem={vi.fn()}
          onBuyAgain={vi.fn()}
          onLoadout={vi.fn()}
          campaignId={1}
          warbandId={9}
          onPick={vi.fn()}
        />
      </MemoryRouter>
    );
  const box = (name: RegExp) => screen.getByRole("button", { name });

  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /skill-groups/?campaign_id=1", [skillGroup({ id: 10, skill_ids: [7] })]);
  });

  // William, 22 Nov 2026: "they just need to show their Subtype not their other rules in their
  // subtitles": an item's subtype, a skill's group, a spell's lore, a boon or bane's type
  it("show what each is under its name, and nothing more", async () => {
    renderDetails();

    expect(box(/^Sword/)).toHaveTextContent(/^SwordMelee$/);
    expect(box(/^Buckler/)).toHaveTextContent(/^BucklerShield$/);
    expect(await screen.findByText("Combat")).toBeInTheDocument();
    expect(box(/^Strike to Injure/)).toHaveTextContent(/^Strike to InjureCombat$/);
    expect(box(/^Fires of U'Zhul/)).toHaveTextContent(/^Fires of U'ZhulLesser Magic$/);
    expect(box(/^Old Battle Wound/)).toHaveTextContent(/^Old Battle WoundInjury$/);
  });

  it("keep the rest for the opened box", async () => {
    const user = setupUser();
    renderDetails();
    await user.click(box(/^Fires of U'Zhul/));

    expect(screen.getByText("Lesser Magic · Difficulty 7")).toBeInTheDocument();
  });

  // William, 22 Nov 2026: "max and min width half the space so 2 always fit on mobile, web they
  // can be a normal size"
  it("sit two abreast on a phone and keep their own size on the web", () => {
    renderDetails();

    for (const tile of [box(/^Sword/), box(/^Strike to Injure/), box(/^Add item/)])
      expect(tile).toHaveClass(
        "max-[960px]:w-[calc(50%-3px)]",
        "max-[960px]:min-w-0",
        "max-[960px]:max-w-none"
      );
    expect(box(/^Sword/)).toHaveClass("min-w-[118px]", "max-w-[200px]");
  });
});

// William, 22 Nov 2026: "Henchmen dont need kills displayed here, on their line is enough and it
// can just be a button with the number and icon ... their dismiss button should be a red text
// button"
describe("An open group's members", () => {
  const knives: RosterUnit = { kind: "henchmen_group", unit: makeVeteranHenchmenGroup() };
  const kill = (id: number, victim: string, by: string) => ({
    id,
    victim,
    victim_kind: "hero" as const,
    victim_warband: "The Rats",
    battle_id: 3,
    scenario: "Skirmish",
    date: "2026-11-01T12:00:00Z",
    round: 2,
    phase: "fight" as const,
    how: "melee" as const,
    by,
  });

  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /skill-groups/?campaign_id=1", []);
    fakeApi.on("GET /warbands/9/stash/", []);
    fakeApi.on("GET /warbands/9/henchmen-groups/21/kill-history/", {
      total_kills: 3,
      kills: [kill(1, "Snikrit", "Blade One"), kill(2, "Skab", "Blade Three")],
    });
  });

  it("each show their own kills as a number, and Dismiss in red", async () => {
    const user = setupUser();
    renderWithQueryClient(
      <MemoryRouter>
        <UnitDetails
          entry={knives}
          campaign={{ id: 1 } as CampaignSummary}
          canEdit
          others={[]}
          onXp={vi.fn()}
          onMoveItem={vi.fn()}
          onSellItem={vi.fn()}
          onBuyAgain={vi.fn()}
          onLoadout={vi.fn()}
          campaignId={1}
          warbandId={9}
          onPick={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getAllByRole("button", { name: /^Kills \d/ })).toHaveLength(2);
    const blade = screen.getByRole("button", { name: "Kills 2: the breakdown" });
    expect(blade).toHaveTextContent(/^2$/);
    expect(screen.getAllByRole("button", { name: "Dismiss" })[0]).toHaveClass("text-danger");

    await user.click(blade);
    const list = await screen.findByRole("dialog", { name: "Kills of Blade One" });
    expect(await within(list).findByText("Snikrit in melee")).toBeInTheDocument();
    expect(within(list).queryByText(/Skab/)).not.toBeInTheDocument();
  });
});
