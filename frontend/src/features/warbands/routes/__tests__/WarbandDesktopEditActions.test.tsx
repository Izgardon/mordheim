import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Warband from "../Warband";

const mocks = vi.hoisted(() => {
  const deferred = () => {
    let resolve!: (value: unknown) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  return {
    deferred,
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
    loadItems: vi.fn(),
    loadSkills: vi.fn(),
    resetHeroForms: vi.fn(),
    initializeHeroForms: vi.fn(),
    resetHeroCreationForm: vi.fn(),
    setMobileTopBar: vi.fn(),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
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
    tradeSession: null,
  }),
}));

vi.mock("../../../auth/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: 7 },
  }),
}));

vi.mock("../../hooks/campaign/useCampaignMemberPermissions", () => ({
  useCampaignMemberPermissions: () => ({
    memberPermissions: [],
  }),
}));

vi.mock("../../hooks/warband/useWarbandLoader", () => ({
  useWarbandLoader: () => ({
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
    setWarband: mocks.setWarband,
    heroes: [],
    setHeroes: mocks.setHeroes,
    hiredSwords: [],
    setHiredSwords: mocks.setHiredSwords,
    henchmenGroups: [],
    setHenchmenGroups: mocks.setHenchmenGroups,
    isLoading: false,
    error: "",
  }),
}));

vi.mock("../../hooks/heroes/useHeroForms", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    useHeroForms: () => ({
      heroForms: [],
      removedHeroIds: [],
      updateHeroForm: vi.fn(),
      setLeaderHeroForm: vi.fn(),
      removeHeroForm: vi.fn(),
      appendHeroForm: vi.fn(),
      expandedHeroId: null,
      setExpandedHeroId: vi.fn(),
      initializeHeroForms: mocks.initializeHeroForms,
      resetHeroForms: mocks.resetHeroForms,
      originalHeroFormsRef: React.createRef<Map<number, string>>(),
    }),
  };
});

vi.mock("../../hooks/heroes/useHeroCreationForm", () => ({
  useHeroCreationForm: () => ({
    newHeroForm: {},
    setNewHeroForm: vi.fn(),
    isAddingHeroForm: false,
    setIsAddingHeroForm: vi.fn(),
    newHeroError: "",
    setNewHeroError: vi.fn(),
    raceQuery: "",
    setRaceQuery: vi.fn(),
    isRaceDialogOpen: false,
    setIsRaceDialogOpen: vi.fn(),
    matchingRaces: [],
    isHeroLimitReached: false,
    handleAddHero: vi.fn(),
    resetHeroCreationForm: mocks.resetHeroCreationForm,
  }),
}));

vi.mock("../../hooks/warband/useWarbandEditState", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    useWarbandEditState: () => {
      const [isEditing, setIsEditing] = React.useState(false);
      const [isLoadingHeroDetails, setIsLoadingHeroDetails] = React.useState(false);
      const [warbandForm, setWarbandForm] = React.useState({
        name: "The Black Wolves",
        faction: "Mercenaries",
      });
      const [pendingEditFocus, setPendingEditFocus] = React.useState(null);

      return {
        isEditing,
        setIsEditing,
        isLoadingHeroDetails,
        setIsLoadingHeroDetails,
        warbandForm,
        setWarbandForm,
        heroPendingPurchases: [],
        setHeroPendingPurchases: vi.fn(),
        pendingEditFocus,
        setPendingEditFocus,
        heroPendingSpend: 0,
        heroPendingChanges: [],
        handleHeroPendingPurchaseAdd: vi.fn(),
        handleHeroPendingPurchaseRemove: vi.fn(),
      };
    },
  };
});

vi.mock("../../hooks/warband/useWarbandSave", () => ({
  useWarbandSave: () => ({
    isSaving: false,
    saveError: "",
    setSaveError: vi.fn(),
    hasAttemptedSave: false,
    setHasAttemptedSave: vi.fn(),
    handleSaveChanges: vi.fn(),
  }),
}));

vi.mock("../../hooks/warband/useWarbandWarchest", () => ({
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

vi.mock("../../hooks/warband/useWarbandTradeSession", () => ({
  useWarbandTradeSession: () => ({
    tradeRequest: null,
    setTradeRequest: vi.fn(),
    handleTradeRequestCreated: vi.fn(),
    handleTradeSessionClose: vi.fn(),
  }),
}));

vi.mock("../../hooks/warband/useWarbandUpdateListener", () => ({
  useWarbandUpdateListener: vi.fn(),
}));

vi.mock("../../hooks/warband/useWarbandMobileTopBar", () => ({
  getWarbandMobileEditItemId: (section: string, value: string) =>
    `warband-mobile-edit-${section}-${value}`,
  useWarbandMobileTopBar: () => ({
    handleMobileEditChange: mocks.handleMobileEditChange,
    isMobileEditing: false,
  }),
}));

vi.mock("../../api/warbands-api", () => ({
  createWarband: vi.fn(),
  createWarbandHero: vi.fn(),
  getWarbandSummary: vi.fn(),
  getWarbandHeroDetail: vi.fn(),
  listWarbandHeroDetails: mocks.listWarbandHeroDetails,
}));

vi.mock("../../api/warbands-events", () => ({
  emitWarbandUpdate: vi.fn(),
}));

vi.mock("../../components/warband/WarbandPageSkeleton", () => ({
  WarbandPageSkeleton: () => <div>loading</div>,
}));

vi.mock("../../components/shared/dialogs/CreateWarbandDialog", () => ({
  default: () => null,
}));

vi.mock("../../components/tabs/BackstoryTab", () => ({
  default: () => null,
}));

vi.mock("../../components/tabs/LogsTab", () => ({
  default: () => null,
}));

vi.mock("../../components/tabs/TradesTab", () => ({
  default: () => null,
}));

vi.mock("../../components/trade/TradeInviteDialog", () => ({
  default: () => null,
}));

vi.mock("../../components/trade/TradeSessionDialog", () => ({
  default: () => null,
}));

vi.mock("../../components/warband/WarbandMobileMetaBar", () => ({
  default: () => null,
}));

vi.mock("../../components/warband/HeaderIconButton", () => ({
  default: () => null,
}));

vi.mock("../../components/warband/stash/StashItemList", () => ({
  default: () => null,
}));

vi.mock("../../components/warband/WarbandPdfViewerDialog", () => ({
  default: () => null,
}));

vi.mock("../../components/warband/WarbandRatingDialog", () => ({
  default: () => null,
}));

vi.mock("../../components/warband/WarbandRecordIndicator", () => ({
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

vi.mock("../../components/warband/WarbandTabContent", () => ({
  default: (props: {
    sectionActionsHidden?: { heroes?: boolean; henchmen?: boolean; hiredswords?: boolean };
    onEditHeroes?: () => void;
    onCancel?: () => void;
    onHenchmenEditStateChange?: (state: { isActive: boolean }) => void;
    isEditing?: boolean;
    isLoadingHeroDetails?: boolean;
  }) => (
    <div>
      <div data-testid="heroes-hidden">{String(props.sectionActionsHidden?.heroes ?? false)}</div>
      <div data-testid="henchmen-hidden">{String(props.sectionActionsHidden?.henchmen ?? false)}</div>
      <div data-testid="hiredswords-hidden">
        {String(props.sectionActionsHidden?.hiredswords ?? false)}
      </div>
      <div data-testid="heroes-editing">{String(Boolean(props.isEditing))}</div>
      <div data-testid="heroes-loading">{String(Boolean(props.isLoadingHeroDetails))}</div>
      <button type="button" onClick={props.onEditHeroes}>
        Edit heroes section
      </button>
      <button type="button" onClick={props.onCancel}>
        Cancel heroes section
      </button>
      <button
        type="button"
        onClick={() => props.onHenchmenEditStateChange?.({ isActive: true })}
      >
        Start henchmen edit
      </button>
      <button
        type="button"
        onClick={() => props.onHenchmenEditStateChange?.({ isActive: false })}
      >
        Stop henchmen edit
      </button>
    </div>
  ),
}));

describe("Warband desktop section edit actions", () => {
  beforeEach(() => {
    mocks.useMediaQuery.mockReturnValue(false);
    mocks.listWarbandHeroDetails.mockResolvedValue([]);
    mocks.useOutletContext.mockReturnValue({
      campaign: {
        id: 1,
        max_heroes: 6,
        max_hired_swords: 3,
        role: "owner",
      },
      lookups: {
        availableItems: [],
        itemsError: "",
        isItemsLoading: false,
        loadItems: mocks.loadItems,
        availableSkills: [],
        skillsError: "",
        isSkillsLoading: false,
        loadSkills: mocks.loadSkills,
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
      },
      setMobileTopBar: mocks.setMobileTopBar,
      showRejoinBattleButton: false,
    });
  });

  it("locks sibling sections immediately when heroes start loading for edit and restores on cancel", async () => {
    const user = userEvent.setup();

    render(<Warband />);

    expect(screen.getByTestId("heroes-hidden")).toHaveTextContent("false");
    expect(screen.getByTestId("henchmen-hidden")).toHaveTextContent("false");
    expect(screen.getByTestId("hiredswords-hidden")).toHaveTextContent("false");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Edit heroes section" }));
    });

    expect(screen.getByTestId("heroes-hidden")).toHaveTextContent("false");
    expect(screen.getByTestId("henchmen-hidden")).toHaveTextContent("true");
    expect(screen.getByTestId("hiredswords-hidden")).toHaveTextContent("true");

    await waitFor(() =>
      expect(screen.getByTestId("heroes-editing")).toHaveTextContent("true")
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Cancel heroes section" }));
    });

    await waitFor(() =>
      expect(screen.getByTestId("heroes-hidden")).toHaveTextContent("false")
    );
    expect(screen.getByTestId("henchmen-hidden")).toHaveTextContent("false");
    expect(screen.getByTestId("hiredswords-hidden")).toHaveTextContent("false");
  });

  it("clears the desktop lock when hero detail loading fails", async () => {
    const deferred = mocks.deferred();
    const user = userEvent.setup();

    mocks.listWarbandHeroDetails.mockReturnValueOnce(deferred.promise);

    render(<Warband />);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Edit heroes section" }));
    });

    expect(screen.getByTestId("henchmen-hidden")).toHaveTextContent("true");
    expect(screen.getByTestId("hiredswords-hidden")).toHaveTextContent("true");
    expect(screen.getByTestId("heroes-loading")).toHaveTextContent("true");

    await act(async () => {
      deferred.reject(new Error("Unable to load hero details."));
      await deferred.promise.catch(() => undefined);
    });

    await waitFor(() =>
      expect(screen.getByTestId("heroes-loading")).toHaveTextContent("false")
    );
    await waitFor(() =>
      expect(screen.getByTestId("henchmen-hidden")).toHaveTextContent("false")
    );
    expect(screen.getByTestId("hiredswords-hidden")).toHaveTextContent("false");
  });

  it("locks the other sections when henchmen editing becomes active", async () => {
    const user = userEvent.setup();

    render(<Warband />);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Start henchmen edit" }));
    });

    expect(screen.getByTestId("heroes-hidden")).toHaveTextContent("true");
    expect(screen.getByTestId("henchmen-hidden")).toHaveTextContent("false");
    expect(screen.getByTestId("hiredswords-hidden")).toHaveTextContent("true");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Stop henchmen edit" }));
    });

    await waitFor(() =>
      expect(screen.getByTestId("heroes-hidden")).toHaveTextContent("false")
    );
    expect(screen.getByTestId("henchmen-hidden")).toHaveTextContent("false");
    expect(screen.getByTestId("hiredswords-hidden")).toHaveTextContent("false");
  });
});
