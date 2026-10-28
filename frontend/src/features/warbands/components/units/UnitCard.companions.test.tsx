/**
 * A unit's companions on its card (the bestiary rewrite, step 4), summary and expanded alike:
 * mount and pet chips under the name, each opening the beast's profile with Switch off; the stats
 * show the server's `effective_stats` (M and Sv highlighted while mounted, the foot values in a
 * tooltip), never written to the unit; edit mode keeps the unit's own stats. A creature group
 * carries the creature mark. `apiRequest` is answered by a fake server.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import UnitExpandedCard from "./UnitExpandedCard";
import UnitSummaryCard from "./UnitSummaryCard";
import { ShownWarbandProvider } from "../warband/shown-warband-context";
import { AppToaster } from "@/components/ui/toaster";
import { henchmenKind } from "../../units/kinds/henchmen";
import { heroKind } from "../../units/kinds/hero";
import { queryKeys } from "@/lib/query-keys";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeItem, makeVeteranHenchmenGroup, makeVeteranHero } from "@/test/warband-fixtures";

import type { WarbandSheet } from "../../types/warband-sheet";
import type { WarbandHero } from "../../types/warband-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, diceColor: "#2e8555" }),
}));

vi.mock("../shared/unit_details/ExperienceBar", () => ({ default: () => null }));
vi.mock("./UnitListBlocks", () => ({ default: () => null }));

const WARBAND = 9;
const sheetKey = queryKeys.campaign.warbandSheet(7, WARBAND);
const horseStats = {
  movement: 8,
  weapon_skill: 3,
  ballistic_skill: 0,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 3,
  attacks: 1,
  leadership: 5,
  armour_save: null,
};
const horse = makeItem({ id: 140, name: "Warhorse", type: "Animal", beast_kind: "mount" });
const ravenItem = makeItem({ id: 141, name: "Raven", type: "Animal", beast_kind: "pet" });

/** Aldric (M 4, save 5+) riding a warhorse, with a raven. */
const riding = makeVeteranHero({
  items: [
    { ...horse, row_id: 1, companion: true },
    { ...ravenItem, row_id: 2, companion: true },
  ],
  mount: {
    item_row_id: 1,
    item_id: 140,
    name: "Warhorse",
    movement: 8,
    rating_bonus: 5,
    has_profile: true,
    stats: horseStats,
  },
  pets: [{ item_row_id: 2, item_id: 141, name: "Raven", has_profile: false, stats: null }],
  effective_stats: { movement: 8, armour_save: 4 },
});

const sheetWith = (heroes: WarbandHero[]): WarbandSheet => ({
  warband: {
    id: WARBAND,
    name: "The Black Wolves",
    faction: "Mercenaries",
    campaign_id: 7,
    user_id: 1,
    created_at: "",
    updated_at: "",
  },
  summary: { gold: 500, rating: 104, heroes: [], hirelings: [], henchmen_groups: [] },
  capabilities: {
    edit: true,
    level_up: true,
    manage_items: true,
    edit_backstory: true,
    delete: true,
    edit_catalogue: true,
    trade: true,
  },
  heroes,
  henchmen_groups: [],
  hirelings: [],
});

function CachedCard({ expanded, canEdit }: { expanded: boolean; canEdit: boolean }) {
  const sheet = useQuery<WarbandSheet>({
    queryKey: sheetKey,
    queryFn: () => new Promise<never>(() => undefined),
    staleTime: Infinity,
  });
  const unit = sheet.data?.heroes[0];
  if (!unit) return null;
  const props = { kind: heroKind, unit, warbandId: WARBAND, canEdit };
  return expanded ? (
    <UnitExpandedCard {...props} onClose={() => undefined} />
  ) : (
    <UnitSummaryCard {...props} renderExpandedCard={false} />
  );
}

const renderCard = (hero: WarbandHero, { expanded = false, canEdit = true } = {}) => {
  const utils = renderWithQueryClient(
    <ShownWarbandProvider campaignId={7} warbandId={WARBAND}>
      <AppToaster />
      <CachedCard expanded={expanded} canEdit={canEdit} />
    </ShownWarbandProvider>,
    {}
  );
  utils.queryClient.setQueryData(sheetKey, sheetWith([hero]));
  return utils;
};

/** The stats table's value cell under a header ("M", "Sv"). */
const statCell = (label: string) => {
  const table = screen.getByRole("table");
  const headers = within(table).getAllByRole("columnheader");
  const index = headers.findIndex((header) => header.textContent === label);
  return within(table).getAllByRole("cell")[index];
};

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  fakeApi.reset();
});

describe("the unit card's companions", () => {
  it("shows mount and pet chips under the name, and the mounted M and save highlighted", async () => {
    const user = setupUser();
    const { queryClient } = renderCard(riding);

    expect(await screen.findByRole("button", { name: "Mount: Warhorse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pet: Raven" })).toBeInTheDocument();
    expect(statCell("M")).toHaveTextContent(/^8/);
    expect(statCell("AS")).toHaveTextContent(/^4\+/);
    expect(within(statCell("M")).getByText("8")).toHaveAttribute("data-mounted", "true");
    expect(within(statCell("WS")).queryByText("4")).not.toHaveAttribute("data-mounted");
    await user.hover(within(statCell("M")).getByText("8"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("On foot: 4");
    // Never written to the unit's own stats.
    const cached = queryClient.getQueryData<WarbandSheet>(sheetKey)?.heroes[0];
    expect(cached?.movement).toBe(4);
    expect(cached?.armour_save).toBe(5);
  });

  it("lets the keyboard open a mounted stat's On foot tooltip, as the battle marks do", async () => {
    renderCard(riding);
    await screen.findByRole("button", { name: "Mount: Warhorse" });

    for (const [label, mounted, own] of [
      ["M", "8", "On foot: 4"],
      ["AS", "4+", "On foot: 5+"],
    ]) {
      const trigger = within(statCell(label)).getByText(mounted).closest("[tabindex]");
      expect(trigger).toHaveAttribute("tabindex", "0");
      act(() => (trigger as HTMLElement).focus());
      expect(await screen.findByRole("tooltip")).toHaveTextContent(own);
      act(() => (trigger as HTMLElement).blur());
      await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    }
  });

  it("opens a beast's profile from its chip, with Switch off naming the mount's row", async () => {
    const user = setupUser();
    const onFoot = {
      ...riding,
      items: [{ ...horse, row_id: 1, companion: false }, riding.items[1]],
      mount: null,
      effective_stats: null,
    };
    fakeApi.on(`POST /warbands/${WARBAND}/heroes/11/items/1/companion/`, {
      unit: onFoot,
      summary: { gold: 500, rating: 99 },
      warnings: [],
    });
    renderCard(riding);

    await user.click(await screen.findByRole("button", { name: "Mount: Warhorse" }));
    const profile = screen.getByRole("dialog", { name: "Warhorse" });
    expect(within(profile).getByText("Rider rating: +5")).toBeInTheDocument();
    expect(within(profile).getByRole("table")).toHaveTextContent("8");
    await user.click(within(profile).getByRole("button", { name: "Switch off" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fakeApi.bodyOf(`POST /warbands/${WARBAND}/heroes/11/items/1/companion/`)).toEqual({
      on: false,
    });
    expect(screen.queryByRole("button", { name: "Mount: Warhorse" })).not.toBeInTheDocument();
    expect(statCell("M")).toHaveTextContent(/^4$/);
  });

  it("lists the beast's skills, specials and spells in its profile (step 5)", async () => {
    const user = setupUser();
    const taught = {
      ...riding,
      mount: {
        ...riding.mount!,
        skills: [{ id: 900, name: "Thunderous Charge", type: "Mount" }],
        specials: [{ id: 901, name: "Kick", type: "Ability", description: "" }],
        spells: [{ id: 902, name: "Hoof Hex", type: "Beast", dc: "7", description: "" }],
      },
    };
    renderCard(taught);

    await user.click(await screen.findByRole("button", { name: "Mount: Warhorse" }));

    const profile = screen.getByRole("dialog", { name: "Warhorse" });
    expect(within(profile).getByText("Skills:").parentElement).toHaveTextContent(
      "Skills: Thunderous Charge"
    );
    expect(within(profile).getByText("Specials:").parentElement).toHaveTextContent(
      "Specials: Kick"
    );
    expect(within(profile).getByText("Spells:").parentElement).toHaveTextContent(
      "Spells: Hoof Hex (DC 7)"
    );
  });

  it("says a pet has no profile, and offers no Switch off to a viewer", async () => {
    const user = setupUser();
    renderCard(riding, { canEdit: false });

    await user.click(await screen.findByRole("button", { name: "Pet: Raven" }));
    const profile = screen.getByRole("dialog", { name: "Raven" });
    expect(within(profile).getByText("No profile")).toBeInTheDocument();
    expect(within(profile).queryByRole("button", { name: "Switch off" })).not.toBeInTheDocument();
  });

  it("shows the chips and the mounted stats on the expanded card too", async () => {
    renderCard(riding, { expanded: true });

    expect(await screen.findByRole("button", { name: "Mount: Warhorse" })).toBeInTheDocument();
    expect(within(statCell("M")).getByText("8")).toHaveAttribute("data-mounted", "true");
  });

  it("shows no chips on foot, and edit mode keeps the unit's own stats", async () => {
    renderCard(makeVeteranHero());

    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: /^(Mount|Pet): / })).not.toBeInTheDocument();
    expect(heroKind.mapToForm(riding).stats).toMatchObject({ M: "4" });
    expect(heroKind.mapToForm(riding).armour_save).toBe("5+");
  });
});

describe("a group's mount chip", () => {
  it("counts the ridden copies of its mount, not every ridden mount", () => {
    const pony = makeItem({ id: 150, name: "Pony", type: "Animal", beast_kind: "mount" });
    const outriders = makeVeteranHenchmenGroup({
      items: [
        { ...horse, row_id: 1, companion: true },
        { ...horse, row_id: 2, companion: true },
        { ...pony, row_id: 3, companion: true },
      ],
      mount: { ...riding.mount!, item_row_id: 1 },
    });
    renderWithQueryClient(
      <UnitSummaryCard
        kind={henchmenKind}
        unit={outriders}
        warbandId={1}
        renderExpandedCard={false}
      />
    );

    expect(screen.getByRole("button", { name: "Mount: Warhorse x 2" })).toBeInTheDocument();
  });

  it("opens the profile with the group's dismount, which the whole group takes", async () => {
    const user = setupUser();
    const outriders = makeVeteranHenchmenGroup({
      items: [
        { ...horse, row_id: 1, companion: true },
        { ...horse, row_id: 2, companion: true },
        { ...horse, row_id: 3, companion: true },
      ],
      mount: { ...riding.mount!, item_row_id: 1 },
    });
    renderWithQueryClient(
      <UnitSummaryCard
        kind={henchmenKind}
        unit={outriders}
        warbandId={1}
        renderExpandedCard={false}
        canEdit
      />
    );

    await user.click(screen.getByRole("button", { name: "Mount: Warhorse x 3" }));

    const profile = screen.getByRole("dialog", { name: "Warhorse" });
    expect(within(profile).getByRole("button", { name: "Black Knives dismount" })).toBeVisible();
    expect(within(profile).queryByRole("button", { name: "Switch off" })).not.toBeInTheDocument();
  });
});

describe("a mounted group's warnings", () => {
  const message =
    "Every member of a group carries the same gear, so Black Knives can't take the field until each of its 3 members has a Warhorse (it has 1).";
  const shortOfHorses = makeVeteranHenchmenGroup({
    items: [{ ...horse, row_id: 1, companion: true }],
    mount: { ...riding.mount!, item_row_id: 1 },
    mount_warnings: [{ code: "group_mounts", message, mounts: 1, members: 3 }],
  });

  it("shows the server's mount warnings beside the group's name, first, with the keyboard too", async () => {
    renderWithQueryClient(
      <UnitSummaryCard
        kind={henchmenKind}
        unit={shortOfHorses}
        warbandId={1}
        renderExpandedCard={false}
      />
    );

    const mark = screen.getByRole("img", { name: /^Warning: Every member of a group/ });
    expect(mark).toHaveAccessibleName(
      `Warning: ${message} Some items don't divide evenly across all henchmen — adjust item counts to match the group size.`
    );
    expect(mark).toHaveAttribute("tabindex", "0");
    act(() => mark.focus());
    const tooltip = await screen.findByRole("tooltip");
    expect(
      within(tooltip)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual([
      message,
      "Some items don't divide evenly across all henchmen — adjust item counts to match the group size.",
    ]);
  });

  it("shows them on the expanded card too, and nothing for a group without any", () => {
    const { rerender } = renderWithQueryClient(
      <UnitExpandedCard
        kind={henchmenKind}
        unit={shortOfHorses}
        warbandId={1}
        onClose={() => undefined}
      />
    );
    expect(
      screen.getByRole("img", { name: /^Warning: Every member of a group/ })
    ).toBeInTheDocument();

    rerender(
      <UnitExpandedCard
        kind={henchmenKind}
        unit={makeVeteranHenchmenGroup({ mount_warnings: [] })}
        warbandId={1}
        onClose={() => undefined}
      />
    );
    expect(screen.queryByRole("img", { name: /^Warning/ })).not.toBeInTheDocument();
  });
});

describe("a creature group's card", () => {
  it("carries the creature mark; another group doesn't", () => {
    const kennel = makeVeteranHenchmenGroup({
      name: "Kennel",
      source_beast_id: 3,
      beast_kind: "creature",
    });
    const { rerender } = renderWithQueryClient(
      <UnitSummaryCard kind={henchmenKind} unit={kennel} warbandId={1} renderExpandedCard={false} />
    );
    expect(screen.getByRole("img", { name: "Creature" })).toBeInTheDocument();

    rerender(
      <UnitSummaryCard
        kind={henchmenKind}
        unit={makeVeteranHenchmenGroup()}
        warbandId={1}
        renderExpandedCard={false}
      />
    );
    expect(screen.queryByRole("img", { name: "Creature" })).not.toBeInTheDocument();
  });

  it("names its beast under the title, with no race (it has none by design), and a race when given one", () => {
    // Was "Unknown Race - Wardogs".
    const kennel = makeVeteranHenchmenGroup({
      name: "Kennel",
      unit_type: "Wardogs",
      race_id: null,
      race_name: null,
      race: undefined,
      source_beast_id: 3,
      beast_kind: "creature",
    });
    const card = (unit: typeof kennel) => (
      <UnitExpandedCard kind={henchmenKind} unit={unit} warbandId={1} onClose={() => undefined} />
    );
    const { rerender } = renderWithQueryClient(card(kennel));

    expect(screen.getByText("Wardogs", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText(/Unknown Race/)).not.toBeInTheDocument();

    rerender(card({ ...kennel, race_name: "Human" }));
    expect(screen.getByText("Human - Wardogs")).toBeInTheDocument();

    // Any other unit without a race still says so.
    rerender(card({ ...kennel, source_beast_id: null, beast_kind: null }));
    expect(screen.getByText("Unknown Race - Wardogs")).toBeInTheDocument();
  });
});
