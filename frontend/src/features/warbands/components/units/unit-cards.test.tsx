/**
 * Characterisation of the roster cards for all three unit kinds, asserted as visible text so a
 * generic UnitSummaryCard / UnitExpandedCard replaced the per-kind cards (pass 1 PR B, F4).
 * Each kind is reached through `kinds` below; re-point those adapters, not the assertions.
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { useState, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import UnitExpandedCard from "./UnitExpandedCard";
import UnitSummaryCard from "./UnitSummaryCard";
import { heroKind as heroConfig } from "@/features/warbands/units/kinds/hero";
import { henchmenKind as henchmenConfig } from "@/features/warbands/units/kinds/henchmen";
import { hirelingKind as hirelingConfig } from "@/features/warbands/units/kinds/hireling";

import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHireling,
} from "@/features/warbands/types/warband-types";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { byTextContent, hoverTooltipsBeside, readStatsGrid } from "@/test/roster-queries";
import {
  makeSkill,
  makeVeteranHenchmenGroup,
  makeVeteranHero,
  makeVeteranHireling,
} from "@/test/warband-fixtures";

const api = vi.hoisted(() => ({
  getWarbandHeroDetail: vi.fn(),
  getWarbandHenchmenGroupDetail: vi.fn(),
  getWarbandHirelingDetail: vi.fn(),
  getWarbandHeroKillHistory: vi.fn(),
  getWarbandHenchmenGroupKillHistory: vi.fn(),
  getWarbandHirelingKillHistory: vi.fn(),
  updateWarbandHero: vi.fn(),
  updateWarbandHenchmenGroup: vi.fn(),
  updateWarbandHireling: vi.fn(),
  listWarbandHenchmenGroups: vi.fn(),
}));

vi.mock("@/features/warbands/api/warbands-api", () => api);
vi.mock("@/features/warbands/units/unit-api", async () =>
  (await import("@/test/unit-api-mock")).unitApiModuleMock(api)
);
vi.mock("@/features/warbands/api/warband-cache", async (importOriginal) => {
  const updateWarbandCache = vi.fn();
  return {
    ...(await importOriginal<typeof import("@/features/warbands/api/warband-cache")>()),
    useWarbandCacheUpdate: () => updateWarbandCache,
  };
});
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({ warband: null, diceColor: "#2e8555" }),
}));
vi.mock("@/features/campaigns/hooks/useCampaignStarted", () => ({
  useCampaignStarted: () => true,
}));
// Phone width: the XP bar always shows its label and +/- (on desktop they appear on hover).
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));

type Overrides = Record<string, unknown>;
type CardProps = {
  canEdit?: boolean;
  canManageItems?: boolean;
  onUpdated?: (unit: unknown) => void;
  onToggle?: () => void;
  onClose?: () => void;
  isExpanded?: boolean;
  expandButtonPlacement?: "hover" | "bottom";
  levelThresholds?: readonly number[];
  levelUpControl?: ReactNode;
  layoutVariant?: "default" | "mobile";
  showLoadoutOnMobile?: boolean;
};

type KindCase = {
  kind: string;
  summary: (overrides?: Overrides, props?: CardProps) => ReactElement;
  expanded: (overrides?: Overrides, props?: CardProps) => ReactElement;
  detailApi: Mock;
  updateApi: Mock;
  unitId: number;
  name: string;
  levelLine: string;
  summaryStats: Record<string, string>;
  raceStats: Record<string, string>;
  raceLine: string;
  xp: string;
  xpLabel: string;
  xpAfterPlus: number;
  /** XP sent by "+" on a half-rate unit. */
  halfRateXpAfterPlus: number;
  customThresholds: { levelLine: string; xpLabel: string };
  maxXp: number;
  tabs: string[];
  firstTabEntries: string[];
  itemEntries: string[];
  detailedHeadings: string[];
  kills: string;
};

const heroCard = (overrides: Overrides = {}) => makeVeteranHero(overrides as Partial<WarbandHero>);
const groupCard = (overrides: Overrides = {}) =>
  makeVeteranHenchmenGroup(overrides as Partial<HenchmenGroup>);
const hirelingCard = (overrides: Overrides = {}) =>
  makeVeteranHireling(overrides as Partial<WarbandHireling>);

const humanRaceStats = (unit: { [key: string]: unknown }, armour: string) => ({
  M: `${unit.movement}/4`,
  WS: `${unit.weapon_skill}/6`,
  BS: `${unit.ballistic_skill}/6`,
  S: `${unit.strength}/4`,
  T: `${unit.toughness}/4`,
  W: `${unit.wounds}/3`,
  I: `${unit.initiative}/6`,
  A: `${unit.attacks}/4`,
  Ld: `${unit.leadership}/9`,
  Sv: armour,
});

/** Stands in for the sheet cache, which re-renders a card with each write's result. */
function CachedUnit<U>({
  unit,
  onUpdated,
  children,
}: {
  unit: U;
  onUpdated?: (unit: unknown) => void;
  children: (unit: U, onUnitUpdated: (unit: U) => void) => ReactElement;
}) {
  const [shown, setShown] = useState(unit);
  return children(shown, (next) => {
    setShown(next);
    onUpdated?.(next);
  });
}

const kinds: KindCase[] = [
  {
    kind: "hero",
    summary: (overrides, props = {}) => (
      <UnitSummaryCard
        kind={heroConfig}
        unit={heroCard(overrides)}
        warbandId={9}
        canEdit={props.canEdit}
        canManageItems={props.canManageItems}
        onUnitUpdated={props.onUpdated}
        onToggle={props.onToggle}
        isExpanded={props.isExpanded}
        expandButtonPlacement={props.expandButtonPlacement}
        levelThresholds={props.levelThresholds}
        levelUpControl={props.levelUpControl}
        layoutVariant={props.layoutVariant}
        showLoadoutOnMobile={props.showLoadoutOnMobile}
      />
    ),
    expanded: (overrides, props = {}) => (
      <CachedUnit unit={heroCard(overrides)} onUpdated={props.onUpdated}>
        {(unit, onUnitUpdated) => (
          <UnitExpandedCard
            kind={heroConfig}
            unit={unit}
            warbandId={9}
            canEdit={props.canEdit}
            onUnitUpdated={onUnitUpdated}
            onClose={props.onClose ?? (() => {})}
            levelThresholds={props.levelThresholds}
            levelUpControl={props.levelUpControl}
            layoutVariant={props.layoutVariant}
          />
        )}
      </CachedUnit>
    ),
    detailApi: api.getWarbandHeroDetail,
    updateApi: api.updateWarbandHero,
    unitId: 11,
    name: "Aldric the Bold",
    levelLine: "Level 4 Captain",
    summaryStats: {
      M: "4",
      WS: "4",
      BS: "4",
      S: "3",
      T: "3",
      W: "1",
      I: "4",
      A: "1",
      Ld: "8",
      AS: "5+",
    },
    raceStats: humanRaceStats(makeVeteranHero(), "5+"),
    raceLine: "Human - Captain",
    xp: "7",
    xpLabel: "7 / 8 xp",
    xpAfterPlus: 8,
    halfRateXpAfterPlus: 7.5,
    customThresholds: { levelLine: "Level 3 Captain", xpLabel: "7 / 9 xp" },
    maxXp: 90,
    tabs: ["Equipment", "Skills", "Spells", "Specials"],
    firstTabEntries: ["Sword", "Dagger x 2", "Light Armour"],
    itemEntries: ["Sword", "Dagger x 2", "Light Armour"],
    detailedHeadings: ["Items", "Skills", "Spells", "Specials"],
    kills: "3",
  },
  {
    kind: "henchmen group",
    summary: (overrides, props = {}) => (
      <UnitSummaryCard
        kind={henchmenConfig}
        unit={groupCard(overrides)}
        warbandId={9}
        canEdit={props.canEdit}
        canManageItems={props.canManageItems}
        onUnitUpdated={props.onUpdated}
        onToggle={props.onToggle}
        isExpanded={props.isExpanded}
        expandButtonPlacement={props.expandButtonPlacement}
        levelThresholds={props.levelThresholds}
        levelUpControl={props.levelUpControl}
        layoutVariant={props.layoutVariant}
        showLoadoutOnMobile={props.showLoadoutOnMobile}
      />
    ),
    expanded: (overrides, props = {}) => (
      <CachedUnit unit={groupCard(overrides)} onUpdated={props.onUpdated}>
        {(unit, onUnitUpdated) => (
          <UnitExpandedCard
            kind={henchmenConfig}
            unit={unit}
            warbandId={9}
            canEdit={props.canEdit}
            onUnitUpdated={onUnitUpdated}
            onClose={props.onClose ?? (() => {})}
            levelThresholds={props.levelThresholds}
            levelUpControl={props.levelUpControl}
            layoutVariant={props.layoutVariant}
          />
        )}
      </CachedUnit>
    ),
    detailApi: api.getWarbandHenchmenGroupDetail,
    updateApi: api.updateWarbandHenchmenGroup,
    unitId: 21,
    name: "Black Knives",
    levelLine: "Level 2 Thugs (3/5)",
    summaryStats: {
      M: "4",
      WS: "3",
      BS: "3",
      S: "3",
      T: "3",
      W: "1",
      I: "3",
      A: "1",
      Ld: "7",
      AS: "6+",
    },
    raceStats: humanRaceStats(makeVeteranHenchmenGroup(), "6+"),
    raceLine: "Human - Thugs",
    xp: "4",
    xpLabel: "4 / 5 xp",
    xpAfterPlus: 5,
    halfRateXpAfterPlus: 4.5,
    customThresholds: { levelLine: "Level 2 Thugs (3/5)", xpLabel: "4 / 6 xp" },
    maxXp: 14,
    tabs: ["Roster", "Equipment", "Skills", "Specials"],
    firstTabEntries: ["Blade One", "Blade Two", "Blade Three"],
    itemEntries: ["Club x 3", "Dagger x 3"],
    detailedHeadings: ["Roster 3/5", "Items", "Skills", "Specials"],
    kills: "3",
  },
  {
    kind: "hired sword",
    summary: (overrides, props = {}) => (
      <UnitSummaryCard
        kind={hirelingConfig}
        unit={hirelingCard(overrides)}
        warbandId={9}
        canEdit={props.canEdit}
        canManageItems={props.canManageItems}
        onUnitUpdated={props.onUpdated}
        onToggle={props.onToggle}
        isExpanded={props.isExpanded}
        expandButtonPlacement={props.expandButtonPlacement}
        levelThresholds={props.levelThresholds}
        levelUpControl={props.levelUpControl}
        layoutVariant={props.layoutVariant}
        showLoadoutOnMobile={props.showLoadoutOnMobile}
      />
    ),
    expanded: (overrides, props = {}) => (
      <CachedUnit unit={hirelingCard(overrides)} onUpdated={props.onUpdated}>
        {(unit, onUnitUpdated) => (
          <UnitExpandedCard
            kind={hirelingConfig}
            unit={unit}
            warbandId={9}
            canEdit={props.canEdit}
            onUnitUpdated={onUnitUpdated}
            onClose={props.onClose ?? (() => {})}
            levelThresholds={props.levelThresholds}
            levelUpControl={props.levelUpControl}
            layoutVariant={props.layoutVariant}
          />
        )}
      </CachedUnit>
    ),
    detailApi: api.getWarbandHirelingDetail,
    updateApi: api.updateWarbandHireling,
    unitId: 31,
    name: "Brother Hal",
    // On the heroes' table (decision 8): 4 XP is level 3, next at 6.
    levelLine: "Level 3 Warrior Priest",
    summaryStats: {
      M: "4",
      WS: "4",
      BS: "3",
      S: "3",
      T: "3",
      W: "1",
      I: "3",
      A: "1",
      Ld: "8",
      AS: "4+",
    },
    raceStats: humanRaceStats(makeVeteranHireling(), "4+"),
    raceLine: "Human - Warrior Priest",
    xp: "4",
    xpLabel: "4 / 6 xp",
    xpAfterPlus: 5,
    halfRateXpAfterPlus: 4.5,
    customThresholds: { levelLine: "Level 2 Warrior Priest", xpLabel: "4 / 6 xp" },
    maxXp: 90,
    tabs: ["Equipment", "Skills", "Spells", "Specials"],
    firstTabEntries: ["Warhammer", "Light Armour"],
    itemEntries: ["Warhammer", "Light Armour"],
    detailedHeadings: ["Items", "Skills", "Spells", "Specials"],
    kills: "2",
  },
];

/** The XP bar's buttons, named by their step ("Add 1 XP", "Add 0.5 XP" for half-rate units). */
const XP_PLUS = /^Add [\d.]+ XP$/;
const XP_MINUS = /^Remove [\d.]+ XP$/;

const kindsWithNoLevelUps = kinds.filter((entry) => entry.kind !== "hero");

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(kinds)("$kind summary card", (kind) => {
  it("shows the name, level and type line", () => {
    renderWithQueryClient(kind.summary());

    expect(screen.getByText(kind.name)).toBeInTheDocument();
    expect(screen.getByText(byTextContent(kind.levelLine))).toBeInTheDocument();
  });

  it("shows the stat line with the armour save as N+", () => {
    renderWithQueryClient(kind.summary());

    expect(readStatsGrid(screen.getByRole("table"))).toEqual(kind.summaryStats);
  });

  it("shows '-' for a missing stat and armour save", () => {
    renderWithQueryClient(kind.summary({ movement: null, armour_save: null }));

    const stats = readStatsGrid(screen.getByRole("table"));
    expect(stats.M).toBe("-");
    expect(stats.AS).toBe("-");
  });

  it("shows XP progress towards the next level from the kind's default table", () => {
    renderWithQueryClient(kind.summary({}, { canEdit: true }));

    expect(screen.getByText(kind.xpLabel)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: XP_PLUS })).toBeEnabled();
    expect(screen.getByRole("button", { name: XP_MINUS })).toBeInTheDocument();
  });

  it("uses the campaign's thresholds when given", () => {
    renderWithQueryClient(kind.summary({}, { levelThresholds: [3, 6, 9] }));

    expect(screen.getByText(byTextContent(kind.customThresholds.levelLine))).toBeInTheDocument();
    expect(screen.getByText(kind.customThresholds.xpLabel)).toBeInTheDocument();
  });

  it("shows Max Level and no +/- past the last threshold", () => {
    renderWithQueryClient(kind.summary({ xp: kind.maxXp }));

    expect(screen.getByText("Max Level")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: XP_PLUS })).not.toBeInTheDocument();
  });

  it("saves XP +1 through the unit PATCH and reports the updated unit", async () => {
    const user = setupUser();
    const onUpdated = vi.fn();
    kind.updateApi.mockImplementation(async (_w: number, _id: number, body: { xp: number }) => ({
      id: kind.unitId,
      xp: body.xp,
    }));
    renderWithQueryClient(kind.summary({}, { onUpdated, canEdit: true }));

    await user.click(screen.getByRole("button", { name: XP_PLUS }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    // The new XP alone (BUG-63).
    expect(kind.updateApi).toHaveBeenCalledWith(9, kind.unitId, { xp: kind.xpAfterPlus });
    expect(onUpdated).toHaveBeenCalledWith({ id: kind.unitId, xp: kind.xpAfterPlus });
  });

  it("shows viewers who can't edit a read-only XP bar (BUG-31)", () => {
    renderWithQueryClient(kind.summary({}, { canEdit: false }));

    expect(screen.getByText(kind.xpLabel)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: XP_PLUS })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: XP_MINUS })).not.toBeInTheDocument();
  });

  it("puts the XP back and says why when the save fails (BUG-31)", async () => {
    const user = setupUser();
    kind.updateApi.mockRejectedValue(new Error("You can't edit this warband."));
    renderWithQueryClient(kind.summary({}, { canEdit: true }));

    await user.click(screen.getByRole("button", { name: XP_PLUS }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You can't edit this warband.");
    expect(screen.getByText(kind.xpLabel)).toBeInTheDocument();
  });

  it("lists the loadout behind one tab per non-empty block, the first tab open", async () => {
    const user = setupUser();
    renderWithQueryClient(kind.summary());

    for (const tab of kind.tabs) {
      expect(screen.getByRole("button", { name: tab })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: kind.tabs[0] })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    for (const entry of kind.firstTabEntries) {
      expect(screen.getByText(entry)).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "Equipment" }));
    for (const entry of kind.itemEntries) {
      expect(screen.getByRole("button", { name: entry })).toBeInTheDocument();
    }
  });

  it("drops empty blocks from the tabs", () => {
    renderWithQueryClient(kind.summary({ skills: [], specials: [], spells: [] }));

    expect(screen.queryByRole("button", { name: "Skills" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Specials" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Spells" })).not.toBeInTheDocument();
  });

  it("offers item menus only to those who may manage items", () => {
    const { unmount } = renderWithQueryClient(
      kind.summary({ henchmen: [] }, { canEdit: true, canManageItems: false })
    );
    const viewerButtons = screen.getAllByRole("button").length;
    unmount();

    renderWithQueryClient(kind.summary({ henchmen: [] }, { canEdit: true, canManageItems: true }));

    expect(screen.getAllByRole("button").length).toBe(viewerButtons + kind.itemEntries.length);
  });

  it("renders the level-up control it is given", () => {
    renderWithQueryClient(
      kind.summary({}, { levelUpControl: <button type="button">Level Up!</button> })
    );

    expect(screen.getByRole("button", { name: "Level Up!" })).toBeInTheDocument();
  });

  it("offers Expand without hovering, named for the unit (UX-03)", async () => {
    const user = setupUser();
    const onToggle = vi.fn();
    renderWithQueryClient(kind.summary({}, { onToggle }));

    const expand = screen.getByRole("button", { name: `Expand ${kind.name}` });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await user.click(expand);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("names the XP buttons by their step (UX-03)", () => {
    const { unmount } = renderWithQueryClient(kind.summary({}, { canEdit: true }));
    expect(screen.getByRole("button", { name: "Add 1 XP" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove 1 XP" })).toBeInTheDocument();
    unmount();

    renderWithQueryClient(kind.summary({ half_rate: true }, { canEdit: true }));
    expect(screen.getByRole("button", { name: "Add 0.5 XP" })).toBeInTheDocument();
  });

  it("shows an 'Expand details' button at the bottom on mobile", async () => {
    const user = setupUser();
    const onToggle = vi.fn();
    renderWithQueryClient(kind.summary({}, { onToggle, expandButtonPlacement: "bottom" }));

    const expand = screen.getByRole("button", { name: "Expand details" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await user.click(expand);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders the expanded card in place when expanded", () => {
    renderWithQueryClient(kind.summary({}, { isExpanded: true }));

    expect(screen.getByRole("heading", { name: kind.name })).toBeInTheDocument();
    expect(screen.getByText(kind.raceLine)).toBeInTheDocument();
  });
});

describe.each(kinds)("$kind expanded card", (kind) => {
  it("shows the name, race and type, and the XP total", () => {
    renderWithQueryClient(kind.expanded());

    expect(screen.getByRole("heading", { name: kind.name })).toBeInTheDocument();
    expect(screen.getByText(kind.raceLine)).toBeInTheDocument();
    expect(screen.getByText("XP").parentElement).toHaveTextContent(`XP${kind.xp}`);
  });

  it("shows each stat over its race maximum", () => {
    renderWithQueryClient(kind.expanded());

    expect(readStatsGrid(screen.getByRole("table"))).toEqual(kind.raceStats);
  });

  it("shows deeds, or a placeholder when there are none", () => {
    const { unmount } = renderWithQueryClient(kind.expanded());
    expect(screen.getByText(/^(Slew|Held|Blessed) /)).toBeInTheDocument();
    unmount();

    renderWithQueryClient(kind.expanded({ deeds: "" }));
    expect(screen.getByText("No deeds recorded yet.")).toBeInTheDocument();
  });

  it("shows the kill count, which opens the named kills", () => {
    renderWithQueryClient(kind.expanded());

    expect(
      screen.getByRole("button", { name: `Show named kills for ${kind.name}` })
    ).toHaveTextContent(`Kills${kind.kills}`);
  });

  it("lists every non-empty block under its own heading", () => {
    renderWithQueryClient(kind.expanded());

    for (const heading of kind.detailedHeadings) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
    for (const entry of kind.itemEntries) {
      expect(screen.getByRole("button", { name: entry })).toBeInTheDocument();
    }
  });

  it("shows the XP bar", () => {
    renderWithQueryClient(kind.expanded());

    expect(screen.getByText(kind.xpLabel)).toBeInTheDocument();
  });

  it("closes from the Close button", async () => {
    const user = setupUser();
    const onClose = vi.fn();
    renderWithQueryClient(kind.expanded({}, { onClose }));

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the unit it is given without fetching it again (PERF-26)", () => {
    renderWithQueryClient(kind.expanded());

    expect(screen.getByRole("heading", { name: kind.name })).toBeInTheDocument();
    expect(kind.detailApi).not.toHaveBeenCalled();
  });

  it("shows Large as a Size tile", () => {
    renderWithQueryClient(kind.expanded({ large: true }));

    expect(screen.getByText("Size").parentElement).toHaveTextContent("SizeLarge");
  });
});

describe.each(kinds)("$kind cards in the mobile layout", (kind) => {
  it("hides the summary loadout unless the warband shows it on mobile", () => {
    const { unmount } = renderWithQueryClient(kind.summary({}, { layoutVariant: "mobile" }));
    expect(screen.queryByRole("button", { name: "Equipment" })).not.toBeInTheDocument();
    unmount();

    renderWithQueryClient(kind.summary({}, { layoutVariant: "mobile", showLoadoutOnMobile: true }));
    expect(screen.getByRole("button", { name: "Equipment" })).toBeInTheDocument();
  });

  it("folds the deeds away and closes from the bottom button on the expanded card", async () => {
    const user = setupUser();
    const onClose = vi.fn();
    renderWithQueryClient(kind.expanded({}, { layoutVariant: "mobile", onClose }));

    const deeds = screen.getByRole("button", { name: /Deeds/ });
    expect(deeds).toHaveAttribute("aria-expanded", "false");
    await user.click(deeds);
    expect(deeds).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/^(Slew|Held|Blessed) /)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close details" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe.each(kindsWithNoLevelUps)("$kind with no level-ups", (kind) => {
  it("hides the XP bar on both cards", () => {
    const { unmount } = renderWithQueryClient(kind.summary({ no_level_ups: true }));
    expect(screen.queryByText(kind.xpLabel)).not.toBeInTheDocument();
    unmount();

    renderWithQueryClient(kind.expanded({ no_level_ups: true }));
    expect(screen.queryByText(kind.xpLabel)).not.toBeInTheDocument();
  });
});

describe("hero card extras", () => {
  const [hero] = kinds;

  it("has no 'no level-ups' switch: the XP bar stays", () => {
    renderWithQueryClient(hero.summary({ no_level_ups: true }));

    expect(screen.getByText(hero.xpLabel)).toBeInTheDocument();
  });

  it("steps half-rate XP by 0.5", async () => {
    const user = setupUser();
    api.updateWarbandHero.mockResolvedValue(heroCard({ xp: 7.5 }));
    renderWithQueryClient(hero.summary({ half_rate: true }, { canEdit: true }));

    await user.click(screen.getByRole("button", { name: XP_PLUS }));

    await waitFor(() =>
      expect(api.updateWarbandHero).toHaveBeenCalledWith(
        9,
        11,
        expect.objectContaining({ xp: hero.halfRateXpAfterPlus })
      )
    );
  });

  it("shows the leader crown beside the name, on both cards", async () => {
    const { unmount } = renderWithQueryClient(hero.summary());
    expect(await hoverTooltipsBeside(screen.getByText(hero.name))).toEqual(["Leader"]);
    unmount();

    renderWithQueryClient(hero.expanded());
    expect(await hoverTooltipsBeside(screen.getByRole("heading", { name: hero.name }))).toEqual([
      "Leader",
    ]);
  });

  it("shows no crown for other heroes", async () => {
    renderWithQueryClient(hero.summary({ is_leader: false }));

    expect(await hoverTooltipsBeside(screen.getByText(hero.name))).toEqual([]);
  });

  it("lets the Trade badge mark the trading action as used", async () => {
    const user = setupUser();
    const onUpdated = vi.fn();
    api.updateWarbandHero.mockResolvedValue(heroCard({ trading_action: false }));
    renderWithQueryClient(hero.summary({}, { onUpdated, canEdit: true }));

    await user.click(
      screen.getByRole("button", {
        name: "Mark Aldric the Bold as having used their trading action",
      })
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Mark Aldric the Bold as having used their trading action?");
    await user.click(within(dialog).getByRole("button", { name: "Confirm Trade" }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
    expect(api.updateWarbandHero).toHaveBeenCalledWith(9, 11, { trading_action: false });
  });

  it("shows a spent Trade badge as plain text", () => {
    renderWithQueryClient(hero.summary({ trading_action: false }));

    expect(screen.getByText("Trade")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /as having used their trading action/ })
    ).not.toBeInTheDocument();
  });

  it("shows viewers the Trade badge without letting them mark it (BUG-31)", () => {
    renderWithQueryClient(hero.summary({}, { canEdit: false }));

    expect(screen.getByTitle("Trading action available")).toHaveTextContent("Trade");
    expect(
      screen.queryByRole("button", {
        name: "Mark Aldric the Bold as having used their trading action",
      })
    ).not.toBeInTheDocument();
  });

  it("keeps the trade dialog open with the error when marking fails (BUG-31)", async () => {
    const user = setupUser();
    api.updateWarbandHero.mockRejectedValue(new Error("Forbidden"));
    renderWithQueryClient(hero.summary({}, { canEdit: true }));

    await user.click(
      screen.getByRole("button", {
        name: "Mark Aldric the Bold as having used their trading action",
      })
    );
    await user.click(await screen.findByRole("button", { name: "Confirm Trade" }));

    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Forbidden");
    expect(within(dialog).getByRole("button", { name: "Confirm Trade" })).toBeEnabled();
  });

  it("opens 'Learn New Skill' from a pending skill for editors only (BUG-31)", async () => {
    const user = setupUser();
    const pending = { skills: [makeSkill({ id: 299, name: "New Skill", type: "Pending" })] };
    const { unmount } = renderWithQueryClient(hero.summary(pending, { canEdit: false }));

    await user.click(screen.getByRole("button", { name: "Skills" }));
    await user.click(screen.getByRole("button", { name: "New Skill" }));
    expect(screen.queryByRole("dialog", { name: "Learn New Skill" })).not.toBeInTheDocument();
    unmount();

    renderWithQueryClient(hero.summary(pending, { canEdit: true }));
    await user.click(screen.getByRole("button", { name: "Skills" }));
    await user.click(screen.getByRole("button", { name: "New Skill" }));
    expect(await screen.findByRole("dialog", { name: "Learn New Skill" })).toBeInTheDocument();
  });

  it("shows the trading action, caster and total cost on the expanded card", () => {
    renderWithQueryClient(hero.expanded({}, { canEdit: true }));

    expect(
      screen.getByRole("button", {
        name: "Mark Aldric the Bold as having used their trading action",
      })
    ).toHaveTextContent("Trading ActionAvailable");
    expect(screen.getByText("Caster").parentElement).toHaveTextContent("CasterWizard");
    // Base 60 + Sword 10 + 2 Daggers + Light Armour 20.
    expect(screen.getByText("Total Cost").parentElement).toHaveTextContent("Total Cost94");
  });

  it("shows the expanded trading action read-only to viewers", () => {
    renderWithQueryClient(hero.expanded({}, { canEdit: false }));

    expect(screen.getByText("Trading Action").parentElement).toHaveTextContent(
      "Trading ActionAvailable"
    );
    expect(
      screen.queryByRole("button", { name: /as having used their trading action/ })
    ).not.toBeInTheDocument();
  });

  it("shows a spent trading action on the expanded card", () => {
    renderWithQueryClient(hero.expanded({ trading_action: false }, { canEdit: true }));

    expect(screen.getByText("Trading Action").parentElement).toHaveTextContent(
      "Trading ActionSpent"
    );
  });

  it("reports the update once after confirming a trade on the expanded card (BUG-99)", async () => {
    const user = setupUser();
    const onUpdated = vi.fn();
    api.updateWarbandHero.mockResolvedValue(heroCard({ trading_action: false }));
    renderWithQueryClient(hero.expanded({}, { onUpdated, canEdit: true }));

    await user.click(
      screen.getByRole("button", {
        name: "Mark Aldric the Bold as having used their trading action",
      })
    );
    await user.click(await screen.findByRole("button", { name: "Confirm Trade" }));

    await waitFor(() =>
      expect(screen.getByText("Trading Action").parentElement).toHaveTextContent(
        "Trading ActionSpent"
      )
    );
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(api.updateWarbandHero).toHaveBeenCalledTimes(1);
  });
});

describe("henchmen card extras", () => {
  const henchmen = kinds[1];

  it("steps half-rate XP by 0.5, like the other kinds (BUG-33)", async () => {
    const user = setupUser();
    api.updateWarbandHenchmenGroup.mockResolvedValue(groupCard({ xp: 4.5 }));
    renderWithQueryClient(henchmen.summary({ half_rate: true }, { canEdit: true }));

    await user.click(screen.getByRole("button", { name: XP_PLUS }));

    await waitFor(() =>
      expect(api.updateWarbandHenchmenGroup).toHaveBeenCalledWith(
        9,
        21,
        expect.objectContaining({ xp: henchmen.halfRateXpAfterPlus })
      )
    );
    expect(henchmen.halfRateXpAfterPlus).toBe(4.5);
  });

  it("steps half-rate XP by 0.5 on the expanded card too (BUG-33)", async () => {
    const user = setupUser();
    api.updateWarbandHenchmenGroup.mockResolvedValue(groupCard({ xp: 4.5 }));
    renderWithQueryClient(henchmen.expanded({ half_rate: true }, { canEdit: true }));

    await user.click(screen.getByRole("button", { name: XP_PLUS }));

    await waitFor(() =>
      expect(api.updateWarbandHenchmenGroup).toHaveBeenCalledWith(
        9,
        21,
        expect.objectContaining({ xp: 4.5 })
      )
    );
  });

  it("lists the members with their kills in the Roster block", () => {
    renderWithQueryClient(henchmen.expanded());

    expect(screen.getByText("Roster 3/5")).toBeInTheDocument();
    expect(screen.getByText("Blade One").parentElement).toHaveTextContent(/^Blade One\s*2 kills$/);
    expect(screen.getByText("Blade Three").parentElement).toHaveTextContent(
      /^Blade Three\s*1 kills$/
    );
  });

  it("counts members against a default group size of 5", () => {
    renderWithQueryClient(henchmen.summary({ max_size: null, henchmen: [] }));

    expect(screen.getByText(byTextContent("Level 2 Thugs (0/5)"))).toBeInTheDocument();
  });

  it("warns when items don't divide evenly across the members", async () => {
    const group = makeVeteranHenchmenGroup();
    renderWithQueryClient(henchmen.summary({ items: group.items.slice(1) }));

    fireEvent.mouseEnter(
      screen
        .getByText(henchmen.name)
        .parentElement!.parentElement!.querySelector("[aria-describedby]")!
    );
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Some items don't divide evenly across all henchmen"
    );
  });

  it("shows the reinforce cost and the summed member kills, with no caster or trading action", () => {
    renderWithQueryClient(henchmen.expanded());

    // Base 25 + one Club 3 + one Dagger 2 + 2 x 4 XP.
    expect(screen.getByText("Reinforce Cost").parentElement).toHaveTextContent("Reinforce Cost38");
    expect(screen.queryByText("Caster")).not.toBeInTheDocument();
    expect(screen.queryByText("Trading Action")).not.toBeInTheDocument();
    expect(screen.queryByText("Total Cost")).not.toBeInTheDocument();
  });

  it("shows the server's hire_cost as the reinforce cost, and whole XP only (decision 7)", () => {
    const { unmount } = renderWithQueryClient(henchmen.expanded({ hire_cost: 43 }));
    expect(screen.getByText("Reinforce Cost").parentElement).toHaveTextContent("Reinforce Cost43");
    unmount();

    // Without one (an older payload): 25 + 3 + 2 + 2 x 4, the half point dropped.
    renderWithQueryClient(henchmen.expanded({ xp: 4.5 }));
    expect(screen.getByText("Reinforce Cost").parentElement).toHaveTextContent("Reinforce Cost38");
  });

  it("has no Trade badge or crown", async () => {
    renderWithQueryClient(henchmen.summary());

    expect(screen.queryByText("Trade")).not.toBeInTheDocument();
    expect(await hoverTooltipsBeside(screen.getByText(henchmen.name))).toEqual([]);
  });

  it("has no spells block", () => {
    renderWithQueryClient(henchmen.summary({ spells: [{ id: 1, name: "Ignored" }] }));

    expect(screen.queryByRole("button", { name: "Spells" })).not.toBeInTheDocument();
  });
});

describe("hired sword card extras", () => {
  const hired = kinds[2];

  it("steps half-rate XP by 0.5", async () => {
    const user = setupUser();
    api.updateWarbandHireling.mockResolvedValue(hirelingCard({ xp: 4.5 }));
    renderWithQueryClient(hired.summary({ half_rate: true }, { canEdit: true }));

    await user.click(screen.getByRole("button", { name: XP_PLUS }));

    await waitFor(() =>
      expect(api.updateWarbandHireling).toHaveBeenCalledWith(
        9,
        31,
        expect.objectContaining({ xp: hired.halfRateXpAfterPlus })
      )
    );
  });

  it("shows upkeep and total cost (without upkeep) on the expanded card", () => {
    renderWithQueryClient(hired.expanded());

    expect(screen.getByText("Upkeep").parentElement).toHaveTextContent("Upkeep15");
    // Base 40 + Warhammer 3 + Light Armour 20.
    expect(screen.getByText("Total Cost").parentElement).toHaveTextContent("Total Cost63");
    expect(screen.getByText("Caster").parentElement).toHaveTextContent("CasterPriest");
    expect(screen.queryByText("Trading Action")).not.toBeInTheDocument();
  });

  it("shows the blood pact on the expanded card only", () => {
    const { unmount } = renderWithQueryClient(hired.expanded({ blood_pacted: true }));
    expect(screen.getByText("Bloodpacted").parentElement).toHaveTextContent("BloodpactedYes");
    unmount();

    renderWithQueryClient(hired.summary({ blood_pacted: true }));
    expect(screen.queryByText(/blood/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Upkeep")).not.toBeInTheDocument();
  });

  it("has no Trade badge or crown", async () => {
    renderWithQueryClient(hired.summary({ is_leader: true, trading_action: true }));

    expect(screen.queryByText("Trade")).not.toBeInTheDocument();
    expect(await hoverTooltipsBeside(screen.getByText(hired.name))).toEqual([]);
  });
});
