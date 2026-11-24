/**
 * A roster card is trimmed in its kind's metal (William, 7 Nov 2026: "heroes gold HS silver hench
 * bronze"; mockup C): the stripe down its left edge, the marker before its name and its type line,
 * closed or open. A dramatis persona is a hired sword.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { makeHero, makeItem, makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

import type { WarbandHireling } from "../../types/warband-types";
import UnitCard from "./UnitCard";
import type { RosterUnit } from "./unit-view";

const hired = (fields: Partial<WarbandHireling>) =>
  ({ ...makeHero({ id: 3 }), ...fields }) as WarbandHireling;

const renderCard = (
  entry: RosterUnit,
  open = false,
  campaign: CampaignSummary | null = null,
  canEdit = false,
  onRide: (rowId: number, on: boolean) => void = vi.fn()
) =>
  renderWithQueryClient(
    <UnitCard
      entry={entry}
      campaign={campaign}
      warbandId={9}
      open={open}
      canEdit={canEdit}
      onToggle={vi.fn()}
      onLoadout={vi.fn()}
      onEdit={vi.fn()}
      onRide={onRide}
    />
  );

const CASES: [string, RosterUnit, string, string, string, string][] = [
  [
    "a hero",
    { kind: "hero", unit: makeHero({ name: "Aldric Voss", unit_type: "Mercenary Captain" }) },
    "Aldric Voss",
    "Mercenary Captain",
    "gold",
    "hero",
  ],
  [
    "a henchmen group",
    { kind: "henchmen_group", unit: makeVeteranHenchmenGroup({ unit_type: "Warrior" }) },
    "Black Knives",
    "Warrior",
    "bronze",
    "henchmen",
  ],
  [
    "a hired sword",
    { kind: "hireling", unit: hired({ name: "Grukk", unit_type: "Ogre Bodyguard" }) },
    "Grukk",
    "Ogre Bodyguard",
    "silver",
    "hired",
  ],
  [
    "a dramatis persona",
    {
      kind: "hireling",
      unit: hired({ name: "Bertha", unit_type: "Bertha", kind: "dramatis_persona" }),
    },
    "Bertha",
    "Dramatis persona",
    "silver",
    "hired",
  ],
];

describe("A roster card's trim", () => {
  it.each(CASES)("is %s's metal", (_label, entry, name, typeLine, metal, marker) => {
    renderCard(entry);
    const card = screen.getByRole("article");
    const title = screen.getByRole("button", { name: new RegExp(`^${name}`) });

    expect(card).toHaveClass("border-l-[3px]", `border-l-metal-${metal}`);
    // William, 22 Nov 2026: "the diamond icon to be something different depending on whether
    // hero, hench or hired"; the type sits under the name, beside the one marker
    expect(title.querySelector("[data-marker]")).toHaveAttribute("data-marker", marker);
    expect(title.querySelector("[data-marker]")).toHaveClass(`text-metal-${metal}`);
    expect(within(title).getByText(typeLine)).toHaveClass(`text-metal-${metal}`);
    // only its own metal, on any part of the card
    expect(new Set(card.outerHTML.match(/metal-[a-z]+/g))).toEqual(new Set([`metal-${metal}`]));
  });

  it("crowns the leader in the marker's place, with no crown line of its own", () => {
    renderCard({
      kind: "hero",
      unit: makeHero({ name: "Aldric Voss", unit_type: "Mercenary Captain", is_leader: true }),
    });
    const title = screen.getByRole("button", { name: /^Leader Aldric Voss/ });

    expect(within(title).getByRole("img", { name: "Leader" })).toHaveAttribute(
      "data-marker",
      "leader"
    );
    expect(screen.getAllByRole("img", { name: "Leader" })).toHaveLength(1);
  });

  // William, 22 Nov 2026: "use templar shield if a priest, wizard hat if a wizard, keep leader and
  // other heroes the same"
  it.each([
    ["Priest", "priest"],
    ["Wizard", "wizard"],
    ["No", "hero"],
  ] as const)("marks a hero who casts as %s", (caster, marker) => {
    renderCard({ kind: "hero", unit: makeHero({ name: "Brother Anselm", caster }) });
    const title = screen.getByRole("button", { name: /^Brother Anselm/ });
    expect(title.querySelector("[data-marker]")).toHaveAttribute("data-marker", marker);
  });

  // William, 24 Nov 2026: "If a henchman is an animal can we give them an animal icon" (option A)
  it("marks an animal group with a paw print, whatever it carries", () => {
    renderCard({
      kind: "henchmen_group",
      unit: {
        ...makeVeteranHenchmenGroup({ name: "Wolfhounds" }),
        is_animal: true,
        items: [makeItem({ id: 7, name: "Bow", type: "Weapon", subtype: "Missile" })],
      },
    });
    const title = screen.getByRole("button", { name: /^Wolfhounds/ });
    expect(title.querySelector("[data-marker]")).toHaveAttribute("data-marker", "animal");
  });

  // William, 22 Nov 2026: "henchmen group, if they have ranged weapon make them bowman if not swordman"
  it.each([
    [
      "a bow",
      makeItem({ id: 7, name: "Bow", type: "Weapon", subtype: "Missile" }),
      "henchmen_ranged",
    ],
    ["a sword", makeItem({ id: 8, name: "Sword", type: "Weapon", subtype: "Melee" }), "henchmen"],
  ] as const)("marks a henchmen group with %s by its weapons", (_label, item, marker) => {
    renderCard({
      kind: "henchmen_group",
      unit: { ...makeVeteranHenchmenGroup({ name: "Marksmen" }), items: [item] },
    });
    const title = screen.getByRole("button", { name: /^Marksmen/ });
    expect(title.querySelector("[data-marker]")).toHaveAttribute("data-marker", marker);
  });

  it("keeps the leader's crown when the leader casts", () => {
    renderCard({
      kind: "hero",
      unit: makeHero({ name: "Aldric Voss", is_leader: true, caster: "Wizard" }),
    });
    expect(screen.getByRole("img", { name: "Leader" })).toHaveAttribute("data-marker", "leader");
  });

  it("stays on an open card", () => {
    const [, entry] = CASES[0];
    renderCard(entry, true);

    expect(screen.getByRole("article")).toHaveClass("col-span-full", "border-l-metal-gold");
  });
});

describe("A hired sword's blood pact badge", () => {
  const pacted: RosterUnit = {
    kind: "hireling",
    unit: hired({ name: "Grukk", unit_type: "Ogre Bodyguard", blood_pacted: true }),
  };

  it("shows while the campaign has blood pacts on", () => {
    renderCard(pacted, false, { enable_blood_pacts: true } as CampaignSummary);

    expect(screen.getByText("Blood pact")).toBeVisible();
  });

  it("stays off while they are off, and off a hired sword without one", () => {
    renderCard(pacted);
    expect(screen.queryByText("Blood pact")).toBeNull();

    renderCard(
      { kind: "hireling", unit: hired({ name: "Free", unit_type: "Pit Fighter" }) },
      false,
      { enable_blood_pacts: true } as CampaignSummary
    );
    expect(screen.queryByText("Blood pact")).toBeNull();
  });
});

describe("Who the card offers a loadout", () => {
  // William, 21 Nov 2026: a hired sword keeps his kit; his Edit form still adds and takes away
  it("leaves a hired sword's Loadout off, and keeps a hero's", () => {
    renderCard({ kind: "hireling", unit: hired({ name: "Grukk" }) }, false, null, true);
    renderCard({ kind: "hero", unit: makeHero({ name: "Aldric Voss" }) }, false, null, true);

    expect(screen.queryByRole("button", { name: "Loadout of Grukk" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Loadout of Aldric Voss" })).toBeInTheDocument();
  });
});

describe("A card's top row", () => {
  const mounted: RosterUnit = {
    kind: "hero",
    unit: makeHero({
      name: "Aldric Voss",
      kills: 3,
      missing_games: 1,
      trading_action: true,
      // a hero's payload has no `mounts`: his chips come from the horse he carries
      items: [
        makeItem({ id: 7, row_id: 7, name: "Warhorse", beast_kind: "mount", companion: false }),
      ],
    }),
  };

  // William, 23 Nov 2026: "why am I not able to mount a mount while in the warband page"
  it("offers a hero the horse he carries on foot, and mounts it when pressed", async () => {
    const onRide = vi.fn();
    renderCard(mounted, false, null, true, onRide);

    await userEvent.click(screen.getByRole("button", { name: "On foot" }));

    expect(onRide).toHaveBeenCalledWith(7, true);
  });

  it("names the horse he rides, and a second carried mount by name", () => {
    const riding: RosterUnit = {
      kind: "hero",
      unit: makeHero({
        items: [
          makeItem({ id: 7, row_id: 7, name: "Warhorse", beast_kind: "mount", companion: true }),
          makeItem({ id: 8, row_id: 8, name: "Pony", beast_kind: "mount", companion: false }),
        ],
      }),
    };
    renderCard(riding);

    expect(screen.getByRole("button", { name: "Warhorse" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Pony" })).toHaveAttribute("aria-pressed", "false");
  });

  // William, 22 Nov 2026: "When not expanded we don't need to show kills at all"
  it("shows no kills while closed, and keeps the mount and Missing", () => {
    renderCard(mounted);

    expect(screen.queryByRole("button", { name: /^Kills/ })).toBeNull();
    for (const badge of [
      screen.getByRole("button", { name: "On foot" }),
      screen.getByText(/^Missing/),
    ])
      expect(badge).toHaveClass("min-h-[30px]", "px-2.5", "text-xs", "font-bold");
  });

  // the head is his name's (William, 22 Nov 2026: "name and type deserve more width"): a hero's
  // badges sit opposite his trading action, on its row
  it("puts a hero's badges opposite his trading action, out of the head", () => {
    renderCard(mounted, true);
    const row = screen.getByRole("switch", { name: /Trading action/ }).closest("div.flex");

    expect(row?.firstElementChild).toContainElement(
      screen.getByRole("button", { name: "On foot" })
    );
    expect(row?.firstElementChild).toContainElement(screen.getByText(/^Missing/));
    expect(row?.firstElementChild).not.toContainElement(screen.getByRole("switch"));
  });

  // William, 22 Nov 2026: "Hide trading action on simple unit card too, already shows where it
  // matters"
  it("leaves the trading action off a closed card, keeping his badges under the head", () => {
    renderCard(mounted);

    expect(screen.queryByRole("switch", { name: /Trading action/ })).toBeNull();
    expect(screen.getByRole("button", { name: "On foot" })).toBeInTheDocument();
  });

  it("leaves out the line under a closed hero's head when he has no badges", () => {
    const { container } = renderCard({ kind: "hero", unit: makeHero({ trading_action: true }) });

    expect(screen.queryByRole("switch")).toBeNull();
    expect(container.querySelector("article > div > div.justify-between")).toBeNull();
  });

  it("puts a hero's kills opposite his trading action when open", () => {
    renderCard(mounted, true);
    const kills = screen.getByRole("button", { name: /^Kills 3/ });
    const row = screen.getByRole("switch", { name: /Trading action/ }).closest("div.flex");

    expect(kills).toHaveClass("min-h-[30px]", "px-2.5", "text-xs", "font-bold");
    expect(row?.firstElementChild).toContainElement(kills);
  });

  // William, 22 Nov 2026: "Henchmen don't need kills displayed here, on their line is enough"
  it("shows no kills for an open group by its members' names: each member's line has theirs", () => {
    renderCard(
      { kind: "henchmen_group", unit: makeVeteranHenchmenGroup({ unit_type: "Warrior" }) },
      true
    );

    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Kills 3/ })).toBeNull();
  });

  it("leaves a hired sword's kills in the head, beside his buttons", () => {
    renderCard({ kind: "hireling", unit: hired({ name: "Grukk", kills: 2 }) }, true);

    expect(
      screen.getByRole("button", { name: /^Kills 2/ }).closest("div.flex-wrap")
    ).toContainElement(screen.getByRole("button", { name: "Close Grukk" }));
  });
});

describe("An open card's Edit", () => {
  const aldric: RosterUnit = { kind: "hero", unit: makeHero({ name: "Aldric Voss" }) };

  // William, 22 Nov 2026: "When expanded the loadout icon button can disappear ... so the Edit
  // button takes its place, which on mobile should just be the edit icon"
  it("takes the Loadout's place", () => {
    renderCard(aldric, false, null, true);
    expect(screen.getByRole("button", { name: "Loadout of Aldric Voss" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Aldric Voss" })).toBeNull();
  });

  it("replaces it once open, labelled on the web", () => {
    renderCard(aldric, true, null, true);

    expect(screen.queryByRole("button", { name: "Loadout of Aldric Voss" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit Aldric Voss" })).toHaveTextContent("Edit");
  });

  it("is the pencil alone on a phone, still named for him", () => {
    renderCard(aldric, true, null, true);
    const edit = screen.getByRole("button", { name: "Edit Aldric Voss" });

    expect(edit).toHaveClass("max-[960px]:w-9");
    expect(within(edit).getByText("Edit")).toHaveClass("max-[960px]:hidden");
  });
});
