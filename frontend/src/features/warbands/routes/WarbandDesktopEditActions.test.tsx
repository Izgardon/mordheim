import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Warband from "./Warband";
import { renderWithQueryClient } from "@/test/query-test-utils";

const mocks = vi.hoisted(() => ({
  useMediaQuery: vi.fn(),
  useOutletContext: vi.fn(),
  setSearchParams: vi.fn(),
  listWarbandHeroDetails: vi.fn(),
  handleMobileEditChange: vi.fn(),
  setStoreWarband: vi.fn(),
  setWarband: vi.fn(),
  setHeroes: vi.fn(),
  setHiredSwords: vi.fn(),
  setHenchmenGroups: vi.fn(),
  setMobileTopBar: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "1" }),
    useSearchParams: () => [new URLSearchParams(), mocks.setSearchParams],
    useOutletContext: () => mocks.useOutletContext(),
  };
});

vi.mock("@/lib/use-media-query", () => ({
  useMediaQuery: mocks.useMediaQuery,
}));

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({
    warband: null,
    setWarband: mocks.setStoreWarband,
  }),
}));

vi.mock("../../auth/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: 7 },
  }),
}));

vi.mock("../hooks/campaign/useCampaignCatalogues", () => ({
  useCampaignCatalogues: () => ({
    availableItems: [],
    itemsError: "",
    isItemsLoading: false,
    availableSkills: [],
    skillsError: "",
    isSkillsLoading: false,
    availableSpells: [],
    spellsError: "",
    isSpellsLoading: false,
    availableSpecials: [],
    specialsError: "",
    isSpecialsLoading: false,
    availableRaces: [],
    racesError: "",
    isRacesLoading: false,
    handleRaceCreated: vi.fn(),
  }),
}));

// One loaded warband for the whole render: the hero editor syncs its name/faction form from it.
const loaded = vi.hoisted(() => ({
  warband: {
    id: 3,
    campaign_id: 1,
    user_id: 7,
    name: "The Black Wolves",
    faction: "Mercenaries",
    gold: 120,
    rating: 99,
    resources: [],
    wins: 0,
    losses: 0,
    warband_link: null,
    show_loadout_on_mobile: false,
    max_units: 15,
  },
  heroes: [],
  hiredSwords: [],
  henchmenGroups: [],
  capabilities: {
    edit: true,
    level_up: true,
    manage_items: true,
    edit_backstory: true,
    delete: true,
    add_custom: false,
  },
  setUnits: {
    hero: mocks.setHeroes,
    henchmen_group: mocks.setHenchmenGroups,
    hired_sword: mocks.setHiredSwords,
  },
}));

vi.mock("../hooks/warband/useWarbandSheet", () => ({
  useWarbandSheet: () => ({
    warband: loaded.warband,
    mergeWarband: mocks.setWarband,
    showCreated: vi.fn(),
    heroes: loaded.heroes,
    hiredSwords: loaded.hiredSwords,
    henchmenGroups: loaded.henchmenGroups,
    capabilities: loaded.capabilities,
    setUnits: loaded.setUnits,
    isLoading: false,
    error: "",
  }),
}));

vi.mock("../hooks/warband/useWarbandWarchest", () => ({
  useWarbandWarchest: () => ({
    isWarchestOpen: false,
    warchestItems: [],
    setWarchestItems: vi.fn(),
    isWarchestLoading: false,
    warchestError: "",
    loadWarchestItems: vi.fn(),
    toggleWarchest: vi.fn(),
    closeWarchest: vi.fn(),
  }),
}));

vi.mock("../hooks/warband/useWarbandTradeSession", () => ({
  useWarbandTradeSession: () => ({
    session: null,
    tradeRequest: null,
    handleTradeRequestCreated: vi.fn(),
    handleTradeSessionClose: vi.fn(),
  }),
}));

vi.mock("../hooks/warband/useWarbandMobileTopBar", () => ({
  getWarbandMobileEditItemId: (section: string, value: string) =>
    `warband-mobile-edit-${section}-${value}`,
  useWarbandMobileTopBar: () => ({
    handleMobileEditChange: mocks.handleMobileEditChange,
    isMobileEditing: false,
  }),
}));

vi.mock("../api/warbands-api", () => ({
  createWarband: vi.fn(),
  createWarbandHero: vi.fn(),
  getWarbandSummary: vi.fn(),
  getWarbandHeroDetail: vi.fn(),
  listWarbandHeroDetails: mocks.listWarbandHeroDetails,
}));

vi.mock("@/features/warbands/api/warband-cache", async (importOriginal) => {
  const updateWarbandCache = vi.fn();
  return {
    ...(await importOriginal<typeof import("@/features/warbands/api/warband-cache")>()),
    useWarbandCacheUpdate: () => updateWarbandCache,
  };
});

vi.mock("../api/warbands-items", () => ({
  listWarbandItems: vi.fn(async () => []),
}));

vi.mock("../units/unit-api", async () =>
  (await import("@/test/unit-api-mock")).unitApiModuleMock({
    listWarbandHeroDetails: mocks.listWarbandHeroDetails,
  })
);

vi.mock("../components/warband/WarbandPageSkeleton", () => ({
  WarbandPageSkeleton: () => <div>loading</div>,
}));

vi.mock("../components/shared/dialogs/CreateWarbandDialog", () => ({
  default: () => null,
}));

vi.mock("../components/tabs/BackstoryTab", () => ({
  default: () => null,
}));

vi.mock("../components/tabs/LogsTab", () => ({
  default: () => null,
}));

vi.mock("../components/tabs/TreasuryTab", () => ({
  default: () => null,
}));

vi.mock("../components/trade/TradeInviteDialog", () => ({
  default: () => null,
}));

vi.mock("../components/trade/TradeSessionDialog", () => ({
  default: () => null,
}));

vi.mock("../components/warband/WarbandMobileMetaBar", () => ({
  default: () => null,
}));

vi.mock("../components/warband/HeaderIconButton", () => ({
  default: () => null,
}));

vi.mock("../components/warband/stash/StashItemList", () => ({
  default: () => null,
}));

vi.mock("../components/warband/WarbandPdfViewerDialog", () => ({
  default: () => null,
}));

vi.mock("../components/warband/WarbandRatingDialog", () => ({
  default: () => null,
}));

vi.mock("../components/warband/WarbandRecordIndicator", () => ({
  default: () => null,
}));

vi.mock("@components/card-background", () => ({
  CardBackground: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@components/tabbed-card", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/page-subnav", () => ({
  PageSubnav: () => null,
}));

type SectionEditorProps = {
  startEditing: () => void;
  cancelEditing: () => void;
  isEditing: boolean;
};

vi.mock("../components/warband/WarbandTabContent", () => ({
  default: (props: {
    sectionActionsHidden?: { heroes?: boolean; henchmen?: boolean; hiredswords?: boolean };
    editors: { heroes: SectionEditorProps; henchmen: SectionEditorProps };
  }) => (
    <div>
      <div data-testid="heroes-hidden">{String(props.sectionActionsHidden?.heroes ?? false)}</div>
      <div data-testid="henchmen-hidden">
        {String(props.sectionActionsHidden?.henchmen ?? false)}
      </div>
      <div data-testid="hiredswords-hidden">
        {String(props.sectionActionsHidden?.hiredswords ?? false)}
      </div>
      <div data-testid="heroes-editing">{String(Boolean(props.editors.heroes.isEditing))}</div>
      <button type="button" onClick={() => props.editors.heroes.startEditing()}>
        Edit heroes section
      </button>
      <button type="button" onClick={() => props.editors.heroes.cancelEditing()}>
        Cancel heroes section
      </button>
      <button type="button" onClick={() => props.editors.henchmen.startEditing()}>
        Start henchmen edit
      </button>
      <button type="button" onClick={() => props.editors.henchmen.cancelEditing()}>
        Stop henchmen edit
      </button>
    </div>
  ),
}));

describe("Warband desktop section edit actions", () => {
  beforeEach(() => {
    mocks.useMediaQuery.mockReturnValue(false);
    mocks.useOutletContext.mockReturnValue({
      campaign: {
        id: 1,
        max_heroes: 6,
        max_hired_swords: 3,
        role: "owner",
      },
      setMobileTopBar: mocks.setMobileTopBar,
      showRejoinBattleButton: false,
    });
  });

  it("locks sibling sections as soon as heroes start editing, with no load, and restores on cancel", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(<Warband />);

    expect(screen.getByTestId("heroes-hidden")).toHaveTextContent("false");
    expect(screen.getByTestId("henchmen-hidden")).toHaveTextContent("false");
    expect(screen.getByTestId("hiredswords-hidden")).toHaveTextContent("false");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Edit heroes section" }));
    });

    expect(screen.getByTestId("heroes-hidden")).toHaveTextContent("false");
    expect(screen.getByTestId("henchmen-hidden")).toHaveTextContent("true");
    expect(screen.getByTestId("hiredswords-hidden")).toHaveTextContent("true");
    expect(screen.getByTestId("heroes-editing")).toHaveTextContent("true");
    expect(mocks.listWarbandHeroDetails).not.toHaveBeenCalled();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Cancel heroes section" }));
    });

    await waitFor(() => expect(screen.getByTestId("heroes-hidden")).toHaveTextContent("false"));
    expect(screen.getByTestId("henchmen-hidden")).toHaveTextContent("false");
    expect(screen.getByTestId("hiredswords-hidden")).toHaveTextContent("false");
  });

  it("locks the other sections when henchmen editing becomes active", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(<Warband />);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Start henchmen edit" }));
    });

    expect(screen.getByTestId("heroes-hidden")).toHaveTextContent("true");
    expect(screen.getByTestId("henchmen-hidden")).toHaveTextContent("false");
    expect(screen.getByTestId("hiredswords-hidden")).toHaveTextContent("true");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Stop henchmen edit" }));
    });

    await waitFor(() => expect(screen.getByTestId("heroes-hidden")).toHaveTextContent("false"));
    expect(screen.getByTestId("henchmen-hidden")).toHaveTextContent("false");
    expect(screen.getByTestId("hiredswords-hidden")).toHaveTextContent("false");
  });
});
