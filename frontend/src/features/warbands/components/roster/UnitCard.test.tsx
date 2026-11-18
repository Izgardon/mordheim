/**
 * A roster card is trimmed in its kind's metal (William, 7 Nov 2026: "heroes gold HS silver hench
 * bronze"; mockup C): the stripe down its left edge, the gem before its name and its type line,
 * closed or open. A dramatis persona is a hired sword.
 */
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { makeHero, makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

import type { WarbandHireling } from "../../types/warband-types";
import UnitCard from "./UnitCard";
import type { RosterUnit } from "./unit-view";

const hired = (fields: Partial<WarbandHireling>) =>
  ({ ...makeHero({ id: 3 }), ...fields }) as WarbandHireling;

const renderCard = (entry: RosterUnit, open = false, campaign: CampaignSummary | null = null) =>
  renderWithQueryClient(
    <UnitCard
      entry={entry}
      campaign={campaign}
      warbandId={9}
      open={open}
      canEdit={false}
      onToggle={vi.fn()}
      onLoadout={vi.fn()}
      onEdit={vi.fn()}
      onRide={vi.fn()}
    />
  );

const CASES: [string, RosterUnit, string, string, string][] = [
  [
    "a hero",
    { kind: "hero", unit: makeHero({ name: "Aldric Voss", unit_type: "Mercenary Captain" }) },
    "Aldric Voss",
    "Mercenary Captain",
    "gold",
  ],
  [
    "a henchmen group",
    { kind: "henchmen_group", unit: makeVeteranHenchmenGroup({ unit_type: "Warrior" }) },
    "Black Knives",
    "Warrior",
    "bronze",
  ],
  [
    "a hired sword",
    { kind: "hireling", unit: hired({ name: "Grukk", unit_type: "Ogre Bodyguard" }) },
    "Grukk",
    "Ogre Bodyguard",
    "silver",
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
  ],
];

describe("A roster card's trim", () => {
  it.each(CASES)("is %s's metal", (_label, entry, name, typeLine, metal) => {
    renderCard(entry);
    const card = screen.getByRole("article");

    expect(card).toHaveClass("border-l-[3px]", `border-l-metal-${metal}`);
    expect(screen.getByText(name).querySelector("[aria-hidden=true]")).toHaveClass(
      "rotate-45",
      `bg-metal-${metal}`
    );
    expect(screen.getByText(typeLine)).toHaveClass(`text-metal-${metal}`);
    // only its own metal, on any part of the card
    expect(new Set(card.outerHTML.match(/metal-[a-z]+/g))).toEqual(new Set([`metal-${metal}`]));
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

describe("A card's top row", () => {
  const mounted: RosterUnit = {
    kind: "hero",
    unit: makeHero({
      name: "Aldric Voss",
      kills: 3,
      missing_games: 1,
      trading_action: true,
      mounts: [
        {
          item_row_id: 7,
          item_id: 7,
          name: "Warhorse",
          movement: 8,
          rating_bonus: 3,
          has_profile: true,
          stats: null,
        },
      ],
    }),
  };

  it("wears one chip size: the mount, Missing and the kills alike", () => {
    renderCard(mounted);

    for (const badge of [
      screen.getByRole("button", { name: "On foot" }),
      screen.getByText(/^Missing/),
      screen.getByRole("button", { name: /^Kills 3/ }),
    ])
      expect(badge).toHaveClass("min-h-[30px]", "px-2.5", "text-xs", "font-bold");
  });

  it("keeps the trading action off it, on a line of its own", () => {
    renderCard(mounted);
    const badges = screen.getByRole("button", { name: /^Kills 3/ }).closest("div.flex-wrap");

    expect(badges).not.toBeNull();
    expect(within(badges as HTMLElement).queryByRole("switch")).toBeNull();
    expect(screen.getByRole("switch", { name: /Trading action/ })).toBeVisible();
  });
});
