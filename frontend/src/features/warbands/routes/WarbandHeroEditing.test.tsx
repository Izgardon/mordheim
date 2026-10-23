/**
 * Hero editing runs in the shared section editor (useUnitSectionEditor, owned by useWarbandPage).
 * These tests drive it through the route and the real heroes section: Edit Heroes, Add hero,
 * Create hero, Save.
 */
import { screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import Warband from "./Warband";

import type { WarbandHero } from "../types/warband-types";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { getFieldNear, hoverTooltipsBeside } from "@/test/roster-queries";
import { setupUser } from "@/test/user-event";
import { humanRace, makeVeteranHero } from "@/test/warband-fixtures";
import { answerBatch, batchCreates, batchDismissals, batchUpdate } from "@/test/batch-mock";

const api = vi.hoisted(() => ({
  createWarband: vi.fn(),
  batchWarbandHeroes: vi.fn(),
  updateWarband: vi.fn(),
  getWarbandSummary: vi.fn(),
  getWarbandHeroDetail: vi.fn(),
  listWarbandHeroDetails: vi.fn(),
  createWarbandTrade: vi.fn(),
  createWarbandLog: vi.fn(),
}));
const events = vi.hoisted(() => ({ emitWarbandUpdate: vi.fn() }));
const loader = vi.hoisted(() => ({
  heroes: [] as WarbandHero[],
  /** Summary fields the sheet merges into the warband (the roster counts). */
  summary: {} as Record<string, number>,
}));
const viewer = vi.hoisted(() => ({ userId: 7, role: "owner" }));
const router = vi.hoisted(() => ({ setSearchParams: vi.fn() }));

vi.mock("../api/warbands-api", () => api);
vi.mock("@/features/warbands/api/warband-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/warbands/api/warband-cache")>()),
  useWarbandCacheUpdate: () => events.emitWarbandUpdate,
}));
vi.mock("../units/unit-api", async () =>
  (await import("@/test/unit-api-mock")).unitApiModuleMock(api)
);

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "1" }),
    useSearchParams: () => [new URLSearchParams(), router.setSearchParams],
    useOutletContext: () => ({
      campaign: { id: 1, max_heroes: 6, max_hired_swords: 3, role: viewer.role },
      setMobileTopBar: vi.fn(),
      showRejoinBattleButton: false,
    }),
  };
});
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({
    warband: null,
    setWarband: vi.fn(),
    diceColor: "#2e8555",
  }),
}));
vi.mock("@/features/campaigns/hooks/useCampaignStarted", () => ({
  useCampaignStarted: () => true,
}));
vi.mock("../../auth/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: viewer.userId } }) }));
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
    availableRaces: [humanRace],
    racesError: "",
    isRacesLoading: false,
    handleRaceCreated: vi.fn(),
  }),
}));
vi.mock("@/lib/catalogue-queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/catalogue-queries")>()),
  useCatalogue: () => ({ data: [], isLoading: false, error: "" }),
}));
vi.mock("../hooks/warband/useWarbandSheet", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    useWarbandSheet: () => {
      const [warband, setWarband] = React.useState({
        id: 9,
        campaign_id: 1,
        user_id: 7,
        name: "The Black Wolves",
        faction: "Mercenaries",
        gold: 120,
        rating: 99,
        resources: [],
        max_units: 15,
        created_at: "",
        updated_at: "",
        ...loader.summary,
      });
      const [heroes, setHeroes] = React.useState(loader.heroes);
      const [hiredSwords, setHiredSwords] = React.useState([]);
      const [henchmenGroups, setHenchmenGroups] = React.useState([]);
      const setUnits = React.useMemo(
        () => ({ hero: setHeroes, henchmen_group: setHenchmenGroups, hired_sword: setHiredSwords }),
        []
      );
      const mergeWarband = React.useCallback(
        (patch: object) => setWarband((current) => ({ ...current, ...patch })),
        []
      );
      // The server's answer for this viewer: the warband's owner (user 7) or a campaign owner.
      const allowed = viewer.userId === 7 || viewer.role === "owner";
      const capabilities = {
        edit: allowed,
        level_up: allowed,
        manage_items: allowed,
        // The backstory is the owner's alone (decision 13).
        edit_backstory: viewer.userId === 7,
        delete: viewer.userId === 7,
        edit_catalogue: allowed,
      };
      return {
        warband,
        capabilities,
        mergeWarband,
        showCreated: vi.fn(),
        heroes,
        hiredSwords,
        henchmenGroups,
        setUnits,
        isLoading: false,
        error: "",
      };
    },
  };
});
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
  useWarbandMobileTopBar: () => ({ handleMobileEditChange: vi.fn(), isMobileEditing: false }),
}));

const nothing = vi.hoisted(() => () => ({ default: () => null }));
vi.mock("../components/warband/WarbandPageSkeleton", () => ({
  WarbandPageSkeleton: () => <div>loading</div>,
}));
vi.mock("../components/shared/dialogs/CreateWarbandDialog", nothing);
vi.mock("../components/tabs/BackstoryTab", nothing);
vi.mock("../components/tabs/LogsTab", nothing);
vi.mock("../components/tabs/TreasuryTab", nothing);
vi.mock("../components/trade/TradeInviteDialog", nothing);
vi.mock("../components/trade/TradeSessionDialog", nothing);
vi.mock("../components/warband/WarbandMobileMetaBar", nothing);
vi.mock("../components/warband/HeaderIconButton", nothing);
vi.mock("../components/warband/stash/StashItemList", nothing);
vi.mock("../components/warband/WarbandPdfViewerDialog", nothing);
vi.mock("../components/warband/WarbandRatingDialog", nothing);
vi.mock("../components/warband/WarbandRecordIndicator", nothing);
vi.mock("../components/warband/resources/WarbandResourceBar", nothing);
// Only the heroes section renders for real; the henchmen and hired-sword sections stay out.
vi.mock("../components/units/UnitSection", async () => {
  const actual = await vi.importActual<typeof import("../components/units/UnitSection")>(
    "../components/units/UnitSection"
  );
  const RealSection = actual.default;
  return {
    default: (props: Parameters<typeof RealSection>[0]) =>
      props.editor.kind.key === "hero" ? <RealSection {...props} /> : null,
  };
});
vi.mock("@components/card-background", () => ({
  CardBackground: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@components/tabbed-card", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/page-subnav", () => ({
  PageSubnav: ({
    tabs,
    onTabChange,
  }: {
    tabs?: { id: string; label: string }[];
    onTabChange?: (id: string) => void;
  }) => (
    <nav>
      {tabs?.map((tab) => (
        <button key={tab.id} type="button" onClick={() => onTabChange?.(tab.id)}>
          {tab.label}
        </button>
      ))}
    </nav>
  ),
}));

const leader = makeVeteranHero();
const startEditing = async (user: ReturnType<typeof setupUser>) => {
  await user.click(screen.getAllByRole("button", { name: "Edit Heroes" })[0]);
  await screen.findByRole("button", { name: "Add hero" });
};

/** The add-hero form: the nearest container of "Create hero" that holds its name field. */
const addHeroForm = () => {
  let node = screen.getByRole("button", { name: "Create hero" }).parentElement;
  while (node && !within(node).queryByPlaceholderText("Hero name")) {
    node = node.parentElement;
  }
  return node as HTMLElement;
};

const fillNewHero = async (user: ReturnType<typeof setupUser>, { leader = false } = {}) => {
  await user.click(screen.getByRole("button", { name: "Add hero" }));
  const form = addHeroForm();
  await user.type(within(form).getByPlaceholderText("Hero name"), "Gunther");
  await user.type(within(form).getByPlaceholderText("Chieftain, Champion"), "Champion");
  await user.click(within(form).getByPlaceholderText("Search races..."));
  await user.click(screen.getByRole("option", { name: "Human" }));
  const cost = getFieldNear("Recruit cost", form);
  await user.clear(cost);
  await user.type(cost, "35");
  if (leader) {
    await user.click(within(form).getByRole("checkbox"));
  }
};

describe("Warband route: hero editing", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    router.setSearchParams.mockReset();
    loader.heroes = [];
    loader.summary = {};
    viewer.userId = 7;
    viewer.role = "owner";
    api.batchWarbandHeroes.mockImplementation(
      (...args: Parameters<ReturnType<typeof answerBatch>>) =>
        answerBatch(loader.heroes, { gold: 85 })(...args)
    );
    api.getWarbandSummary.mockResolvedValue({ gold: 85 });
  });

  it("queues a new hero until Save, then creates it in one batch with skill access as a list (decision 1, BUG-101)", async () => {
    const user = setupUser();
    renderWithQueryClient(<Warband />);
    await startEditing(user);

    await fillNewHero(user, { leader: true });
    await user.click(screen.getByRole("button", { name: "Create hero" }));

    expect(await screen.findByDisplayValue("Gunther")).toBeInTheDocument();
    expect(screen.getByText("New recruit: 35 gc, paid when you save.")).toBeInTheDocument();
    expect(api.batchWarbandHeroes).not.toHaveBeenCalled();
    expect(api.listWarbandHeroDetails).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.batchWarbandHeroes).toHaveBeenCalledTimes(1));
    expect(api.batchWarbandHeroes).toHaveBeenCalledWith(9, {
      create: [
        expect.objectContaining({
          name: "Gunther",
          unit_type: "Champion",
          race: 1,
          price: 35,
          xp: 0,
          level_up: 0,
          is_leader: true,
          available_skills: [],
          items: [],
        }),
      ],
    });
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("Gunther")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("creates a queued hero with its typed starting XP and level_up 0 (BUG-65)", async () => {
    const user = setupUser();
    renderWithQueryClient(<Warband />);
    await startEditing(user);
    await fillNewHero(user, { leader: true });
    await user.click(screen.getByRole("button", { name: "Create hero" }));
    await screen.findByDisplayValue("Gunther");

    const xp = getFieldNear("Experience");
    await user.clear(xp);
    await user.type(xp, "6");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.batchWarbandHeroes).toHaveBeenCalledTimes(1));
    expect(batchCreates(api.batchWarbandHeroes)).toEqual([
      expect.objectContaining({ name: "Gunther", xp: 6, level_up: 0 }),
    ]);
  });

  it("saves a warband with no heroes without asking for a leader (BUG-64)", async () => {
    const user = setupUser();
    renderWithQueryClient(<Warband />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
    );
    expect(screen.queryByText("Select a leader before saving.")).not.toBeInTheDocument();
  });

  it("asks for name, type and race before creating", async () => {
    const user = setupUser();
    renderWithQueryClient(<Warband />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Add hero" }));
    await user.click(screen.getByRole("button", { name: "Create hero" }));

    expect(screen.getByText("Name, type, and race are required.")).toBeInTheDocument();
    expect(screen.queryByText(/New recruit/)).not.toBeInTheDocument();
  });

  it("drops a queued second leader on Cancel: no request and one crown (decision 1, BUG-30, BUG-34)", async () => {
    const user = setupUser();
    loader.heroes = [leader];
    renderWithQueryClient(<Warband />);
    await startEditing(user);
    await fillNewHero(user, { leader: true });
    await user.click(screen.getByRole("button", { name: "Create hero" }));
    await screen.findByDisplayValue("Gunther");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(await screen.findByRole("button", { name: "Discard changes" }));

    expect(api.batchWarbandHeroes).not.toHaveBeenCalled();
    expect(await hoverTooltipsBeside(await screen.findByText("Aldric the Bold"))).toEqual([
      "Leader",
    ]);
    expect(screen.queryByText("Gunther")).not.toBeInTheDocument();
  });

  it("moves the crown to a queued leader in the forms only, then saves both in one batch", async () => {
    const user = setupUser();
    loader.heroes = [leader];
    renderWithQueryClient(<Warband />);
    await startEditing(user);
    await fillNewHero(user, { leader: true });
    await user.click(screen.getByRole("button", { name: "Create hero" }));
    await screen.findByDisplayValue("Gunther");

    expect(api.batchWarbandHeroes).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.batchWarbandHeroes).toHaveBeenCalledTimes(1));
    expect(batchUpdate(api.batchWarbandHeroes, 11)).toEqual(
      expect.objectContaining({ is_leader: false })
    );
    expect(batchCreates(api.batchWarbandHeroes)).toEqual([
      expect.objectContaining({ name: "Gunther", is_leader: true }),
    ]);
  });

  it("dismisses a hero on Save, and the dialog says so and that his items are lost (decision 3, ROST-TWEAK-02, BUG-34)", async () => {
    const user = setupUser();
    const champion = makeVeteranHero({ id: 12, name: "Champion Otto", is_leader: false });
    loader.heroes = [leader, champion];
    renderWithQueryClient(<Warband />);
    await startEditing(user);

    await user.click(screen.getAllByRole("button", { name: "Dismiss" })[1]);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Are you sure you want to dismiss Champion Otto? The unit is removed when you save, and no gold is refunded."
    );
    expect(dialog).toHaveTextContent(
      "All items this unit carries are lost. Move them to the stash first to keep them."
    );
    expect(dialog).not.toHaveTextContent("cannot be undone");
    await user.click(within(dialog).getByRole("button", { name: "Dismiss hero" }));

    expect(api.batchWarbandHeroes).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(batchDismissals(api.batchWarbandHeroes)).toEqual([12]));
    expect(api.batchWarbandHeroes).toHaveBeenCalledWith(9, { dismiss: [12] });
    expect(api.getWarbandSummary).not.toHaveBeenCalled();
  });

  it("asks before Cancel discards unsaved changes, and keeps them on Keep editing (decision 2)", async () => {
    const user = setupUser();
    loader.heroes = [leader];
    renderWithQueryClient(<Warband />);
    await startEditing(user);
    const xp = getFieldNear("Experience");
    await user.clear(xp);
    await user.type(xp, "9");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Discard your unsaved changes to Heroes?");
    await user.click(within(dialog).getByRole("button", { name: "Keep editing" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getFieldNear("Experience")).toHaveValue(9);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(await screen.findByRole("button", { name: "Discard changes" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
    );
    expect(api.batchWarbandHeroes).not.toHaveBeenCalled();
  });

  it("cancels at once when nothing changed (decision 2)", async () => {
    const user = setupUser();
    loader.heroes = [leader];
    renderWithQueryClient(<Warband />);
    await startEditing(user);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("asks before a tab switch discards unsaved changes (decision 2)", async () => {
    const user = setupUser();
    loader.heroes = [leader];
    renderWithQueryClient(<Warband />);
    await startEditing(user);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    await user.click(await screen.findByRole("button", { name: "Dismiss hero" }));

    await user.click(screen.getByRole("button", { name: "Treasury" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(
      "Discard your unsaved roster changes and leave the Warband tab?"
    );
    expect(router.setSearchParams).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Discard changes" }));

    expect(router.setSearchParams).toHaveBeenCalledTimes(1);
    expect(router.setSearchParams.mock.calls[0][0].get("tab")).toBe("treasury");
    expect(api.batchWarbandHeroes).not.toHaveBeenCalled();
  });

  it("switches tabs at once when nothing changed (decision 2)", async () => {
    const user = setupUser();
    loader.heroes = [leader];
    renderWithQueryClient(<Warband />);

    await user.click(screen.getByRole("button", { name: "Treasury" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.setSearchParams).toHaveBeenCalledTimes(1);
  });

  it("shows the heroes with Level Up! and Edit Heroes to the owner", () => {
    loader.heroes = [leader];
    renderWithQueryClient(<Warband />);

    expect(screen.getByText("[1/6]")).toBeInTheDocument();
    expect(screen.getByText("Aldric the Bold")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Level Up!" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit Heroes" })).toHaveLength(2);
  });

  it("titles Heroes with the server's counts and disables Add hero at the cap with the reason (decision 12, UX-06)", async () => {
    const user = setupUser();
    loader.heroes = [11, 12, 13, 14, 15].map((id) =>
      makeVeteranHero({ id, name: `Hero ${id}`, is_leader: id === 11 })
    );
    loader.summary = { hero_count: 5, max_heroes: 5 };
    renderWithQueryClient(<Warband />);

    expect(screen.getByText("[5/5]")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Edit Heroes" })[0]);

    expect(await screen.findByRole("button", { name: "Add hero" })).toBeDisabled();
    expect(
      screen.getByText("Maximum of 5 heroes reached. Dismiss one to recruit another.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplicate Hero 12" })).toBeDisabled();
  });

  it("warns, but never blocks, when the warband is over its size (decision 12)", async () => {
    const user = setupUser();
    loader.heroes = [leader];
    loader.summary = { unit_count: 16, max_units: 15 };
    renderWithQueryClient(<Warband />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your warband has 16 units, over its limit of 15. Heroes, henchmen and blood-pacted hired swords count."
    );
    await startEditing(user);
    expect(screen.getByRole("button", { name: "Add hero" })).toBeEnabled();
    // In an edit the warning counts the forms: one hero is under the limit.
    expect(screen.queryByText(/over its limit/)).not.toBeInTheDocument();
  });

  it("hides Level Up! and Edit Heroes from a campaign member viewing someone else's warband", () => {
    loader.heroes = [leader];
    viewer.userId = 8;
    viewer.role = "player";
    renderWithQueryClient(<Warband />);

    expect(screen.getByText("Aldric the Bold")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Level Up!" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Heroes" })).not.toBeInTheDocument();
  });
});
