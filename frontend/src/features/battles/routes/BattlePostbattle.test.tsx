import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PostbattleRenderableGroup } from "@/features/battles/components/postbattle/postbattle-utils";
import type {
  BattlePostbattleFindItem,
  BattlePostbattleState,
} from "@/features/battles/types/battle-types";

import { renderWithQueryClient } from "@/test/query-test-utils";

import BattleProvider from "@/features/battles/components/layout/BattleProvider";

import BattlePostbattle from "./BattlePostbattle";

const mocks = vi.hoisted(() => {
  const battleState = {
    battle: {
      id: 2,
      status: "postbattle",
      scenario: "Street Fight",
      created_by_user_id: 7,
    },
    participants: [
      {
        id: 11,
        battle_id: 2,
        status: "in_battle",
        connection_state: "online",
        last_event_id: 0,
        invited_by_user_id: null,
        invited_at: null,
        responded_at: null,
        joined_at: null,
        ready_at: null,
        canceled_at: null,
        battle_joined_at: null,
        finished_at: null,
        confirmed_at: null,
        last_seen_at: null,
        selected_unit_keys_json: ["hero-1", "hireling-1"],
        unit_information_json: {
          "hero-1": { kill_count: 1 },
          "hireling-1": { kill_count: 0 },
        },
        custom_units_json: [],
        postbattle_json: {},
        declared_rating: null,
        battle_notes: "",
        user: {
          id: 7,
          label: "User 7",
        },
        warband: {
          id: 3,
          name: "The Black Wolves",
        },
      },
    ],
    events: [],
  };

  const roster = {
    heroes: [
      {
        key: "hero-1",
        id: 101,
        kind: "hero",
        displayName: "Captain",
        unitType: "Hero",
        rating: 50,
        stats: {
          movement: 4,
          weapon_skill: 4,
          ballistic_skill: 4,
          strength: 4,
          toughness: 3,
          wounds: 1,
          initiative: 4,
          attacks: 1,
          leadership: 8,
          armour_save: null,
        },
      },
    ],
    henchmenGroups: [],
    hirelings: [
      {
        key: "hireling-1",
        id: 201,
        kind: "hireling",
        displayName: "Ogre Bodyguard",
        unitType: "Hired Sword",
        upkeepPrice: 15,
        upkeepCostExpression: "15 gc",
        rating: 80,
        stats: {
          movement: 6,
          weapon_skill: 4,
          ballistic_skill: 2,
          strength: 4,
          toughness: 4,
          wounds: 3,
          initiative: 3,
          attacks: 3,
          leadership: 7,
          armour_save: null,
        },
      },
    ],
    warbandRating: null,
  };

  const draft = {
    exploration: {
      dice_values: [],
      resource_id: 9,
    },
    finds: {
      gold_crowns: 0,
      items: [],
    },
    upkeep: {
      pay_upkeep: true,
      entries: {
        "hireling-1": {
          unit_key: "hireling-1",
          unit_name: "Ogre Bodyguard",
          cost: 15,
        },
      },
    },
    unit_results: {
      "hero-1": {
        unit_key: "hero-1",
        unit_name: "Captain",
        unit_kind: "hero",
        xp_earned: 2,
        kill_count: 1,
        dead: false,
        serious_injury_rolls: [],
      },
      "hireling-1": {
        unit_key: "hireling-1",
        unit_name: "Ogre Bodyguard",
        unit_kind: "hireling",
        xp_earned: 0,
        kill_count: 0,
        dead: false,
        serious_injury_rolls: [],
      },
    },
  };

  const localExploration = {
    diceCount: 2,
    diceValues: [4, 5],
    selectedDice: [true, true],
    hasRolledAllDice: true,
    resourceId: 9,
  };

  const groups: PostbattleRenderableGroup[] = [
    {
      key: "heroes",
      unitKind: "hero",
      label: "Heroes",
      rows: [
        {
          unitKey: "hero-1",
          unitName: "Captain",
          unitType: "Hero",
          unitKind: "hero",
          canGainXp: true,
          injuryTable: "hero",
          xpEarned: 2,
          killCount: 1,
          dead: false,
          outOfAction: true,
          groupName: "",
          specialIds: [],
          seriousInjuryRolls: [],
        },
      ],
    },
  ];

  return {
    battleState,
    roster,
    draft,
    localExploration,
    groups,
    navigate: vi.fn(),
    useMediaQuery: vi.fn(),
    setBattleMobileTopBar: vi.fn(),
    setBattleMobileBottomBar: vi.fn(),
    getBattleState: vi.fn(async () => battleState),
    saveBattleParticipantConfig: vi.fn(async () => battleState),
    saveBattlePostbattleDraft: vi.fn(async () => battleState),
    finalizeBattlePostbattle: vi.fn(async () => battleState),
    confirmBattlePostbattle: vi.fn(async () => battleState),
    getWarbandSheet: vi.fn(async () => ({
      summary: { resources: [{ id: 9, name: "Wyrdstone" }] },
      heroes: [],
      henchmen_groups: [],
      hirelings: [],
    })),
    listItems: vi.fn(async () => [
      {
        id: 77,
        name: "Lucky Charm",
        type: "Miscellaneous",
        description: "A reliable trinket.",
        availabilities: [
          { id: 1, cost: 15, rarity: 8, restrictions: [] },
          { id: 2, cost: 30, rarity: 10, restrictions: [] },
        ],
      },
    ]),
    useBattleEvents: vi.fn(),
    deleteWarbandHireling: vi.fn(async () => undefined),
    refreshOpenBattles: vi.fn(async () => undefined),
    clearCurrentBattleSession: vi.fn(),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate-target">{to}</div>,
    useNavigate: () => mocks.navigate,
    useOutletContext: () => ({
      campaign: {
        name: "Mordheim Campaign",
        hero_death_roll: "d66",
      },
      setBattleMobileTopBar: mocks.setBattleMobileTopBar,
      setBattleMobileBottomBar: mocks.setBattleMobileBottomBar,
    }),
    useParams: () => ({
      id: "1",
      battleId: "2",
    }),
  };
});

vi.mock("@/lib/use-media-query", () => ({
  useMediaQuery: mocks.useMediaQuery,
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: 7 },
  }),
}));

vi.mock("@/stores/app-store", () => ({
  useAppStore: () => ({
    diceColor: "#f5d99b",
    clearCurrentBattleSession: mocks.clearCurrentBattleSession,
  }),
}));

vi.mock("@/features/battles/api/battles-api", () => ({
  getBattleState: mocks.getBattleState,
  saveBattleParticipantConfig: mocks.saveBattleParticipantConfig,
  saveBattlePostbattleDraft: mocks.saveBattlePostbattleDraft,
  finalizeBattlePostbattle: mocks.finalizeBattlePostbattle,
  confirmBattlePostbattle: mocks.confirmBattlePostbattle,
}));

vi.mock("@/features/warbands/api/warbands-api", () => ({
  getWarband: vi.fn(),
  getWarbandSheet: mocks.getWarbandSheet,
}));

vi.mock("@/features/warbands/api/warbands-hirelings", () => ({
  deleteWarbandHireling: mocks.deleteWarbandHireling,
}));

vi.mock("@/features/items/api/items-api", () => ({
  listItems: mocks.listItems,
}));

vi.mock("@/lib/realtime", () => ({
  useBattleEvents: mocks.useBattleEvents,
  useRealtimeReconnect: vi.fn(),
}));

vi.mock("@/features/battles/hooks/useBattleRosters", () => ({
  useBattleRosters: () => ({
    rosters: {
      7: mocks.roster,
    },
    rosterLoading: {
      7: false,
    },
    rosterErrors: {
      7: "",
    },
  }),
}));

vi.mock("@/features/battles/components/postbattle/postbattle-utils", () => ({
  buildD6SeriousInjuryRoll: vi.fn(() => ({
    roll_type: "d6",
    result_code: "1",
    result_label: "Dead",
    dead_suggestion: true,
  })),
  buildHeroSeriousInjuryRoll: vi.fn(() => ({
    roll_type: "d66",
    result_code: "11",
    result_label: "Dead",
    dead_suggestion: true,
  })),
  buildLocalExplorationState: vi.fn(() => ({ ...mocks.localExploration })),
  buildPostbattleDraft: vi.fn(() => ({ ...mocks.draft })),
  buildRenderableGroups: vi.fn(() => mocks.groups),
  // No settled roll in these tests, so nothing saves on its own.
  settledExplorationPayload: vi.fn(() => null),
  getExplorationResourceAmount: vi.fn(() => 2),
  getPostbattleUpkeepTotal: vi.fn(() => 15),
  getSelectedExplorationDiceValues: vi.fn(() => [4, 5]),
  isPostbattleDraftValid: vi.fn(() => true),
  setPostbattlePayUpkeep: vi.fn((draft: unknown) => draft),
  setLocalExplorationDiceCount: vi.fn((state: Record<string, unknown>, nextCount: number) => ({
    ...state,
    diceCount: nextCount,
  })),
  setLocalExplorationDieValue: vi.fn((state: unknown) => state),
  setLocalExplorationDieSelected: vi.fn((state: unknown) => state),
  setLocalExplorationResource: vi.fn(
    (state: Record<string, unknown>, resourceId: number | null) => ({
      ...state,
      resourceId,
    })
  ),
  toPostbattleExplorationPayload: vi.fn(() => ({
    dice_values: [4, 5],
    resource_id: 9,
  })),
  addPostbattleFindItem: vi.fn((draft: BattlePostbattleState, item: BattlePostbattleFindItem) => ({
    ...draft,
    finds: {
      ...draft.finds,
      items: [...draft.finds.items, item],
    },
  })),
  removePostbattleFindItem: vi.fn((draft: BattlePostbattleState, index: number) => ({
    ...draft,
    finds: {
      ...draft.finds,
      items: draft.finds.items.filter((_: unknown, itemIndex: number) => itemIndex !== index),
    },
  })),
  setPostbattleFindsGold: vi.fn((draft: BattlePostbattleState, goldCrowns: number) => ({
    ...draft,
    finds: {
      ...draft.finds,
      gold_crowns: goldCrowns,
    },
  })),
  updateGroupXp: vi.fn((draft: unknown) => draft),
  updatePostbattleUpkeepEntry: vi.fn((draft: unknown) => draft),
  updateUnitResult: vi.fn((draft: unknown) => draft),
}));

vi.mock("@/features/battles/hooks/useOpenCampaignBattles", () => ({
  useRefreshOpenBattles: () => mocks.refreshOpenBattles,
}));

vi.mock("@/components/dice/DiceRoller", () => ({
  default: ({ fixedNotation }: { fixedNotation: string }) => (
    <div data-testid={`dice-roller-${fixedNotation}`}>{fixedNotation}</div>
  ),
}));

vi.mock("@/components/ui/loading-screen", () => ({
  LoadingScreen: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ className, children }: { className?: string; children: ReactNode }) => (
    <div role="dialog" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/features/battles/components/shared/BattleDesktopSubnav", () => ({
  default: ({
    title,
    subtitle,
    participants,
    actions,
  }: {
    title: string;
    subtitle?: string;
    participants: Array<{ user: { id: number }; warband: { name: string } }>;
    actions?: ReactNode;
  }) => (
    <div data-testid="battle-desktop-subnav">
      <p>{title}</p>
      <p>{subtitle}</p>
      {participants.map((participant) => (
        <button key={participant.user.id} type="button">
          {participant.warband.name}
        </button>
      ))}
      <div>{actions}</div>
    </div>
  ),
}));

vi.mock("@/features/battles/components/shared/BattleNotesDialog", () => ({
  default: ({
    open,
    onSave,
  }: {
    open: boolean;
    notes: string;
    onOpenChange: (open: boolean) => void;
    onSave: (notes: string) => Promise<void>;
  }) =>
    open ? (
      <button type="button" onClick={() => void onSave("Updated postbattle note")}>
        Save battle notes
      </button>
    ) : null,
}));

/** A hireling's row in the roster results: Bertha, taken out of action, on `injuryTable`. */
const hirelingGroup = (injuryTable: "hero" | "henchman"): PostbattleRenderableGroup => ({
  key: "hirelings",
  unitKind: "hireling",
  label: "Hired Swords",
  rows: [
    {
      unitKey: "hireling-1",
      unitName: "Bertha",
      unitType: "Bertha Bestraufrung",
      unitKind: "hireling",
      canGainXp: false,
      injuryTable,
      xpEarned: 0,
      killCount: 0,
      dead: false,
      outOfAction: true,
      groupName: "",
      specialIds: [],
      seriousInjuryRolls: [],
    },
  ],
});

describe("BattlePostbattle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (mocks.battleState as { suggested_postbattle?: unknown }).suggested_postbattle;
    mocks.useMediaQuery.mockReturnValue(false);
    mocks.groups = [
      {
        key: "heroes",
        unitKind: "hero",
        label: "Heroes",
        rows: [
          {
            unitKey: "hero-1",
            unitName: "Captain",
            unitType: "Hero",
            unitKind: "hero",
            canGainXp: true,
            injuryTable: "hero",
            xpEarned: 2,
            killCount: 1,
            dead: false,
            outOfAction: true,
            groupName: "",
            specialIds: [],
            seriousInjuryRolls: [],
          },
        ],
      },
    ];
  });

  it("renders the postbattle battle shell on desktop", async () => {
    const { container } = renderWithQueryClient(
      <BattleProvider phase="postbattle">
        <BattlePostbattle />
      </BattleProvider>
    );

    await screen.findByTestId("battle-desktop-subnav");

    expect(container.firstElementChild).toHaveClass("battle-postbattle-page");
    expect(screen.getByTestId("battle-desktop-subnav")).toBeInTheDocument();
    expect(screen.getByText("Mordheim Campaign - Postbattle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "The Black Wolves" })).toBeInTheDocument();
  });

  it("saves Battle Notes through participant config", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <BattleProvider phase="postbattle">
        <BattlePostbattle />
      </BattleProvider>
    );

    await screen.findByTestId("battle-desktop-subnav");

    await user.click(screen.getByRole("button", { name: "Battle Notes" }));
    await user.click(screen.getByRole("button", { name: "Save battle notes" }));

    await waitFor(() => {
      expect(mocks.saveBattleParticipantConfig).toHaveBeenCalledWith(1, 2, {
        battle_notes: "Updated postbattle note",
      });
    });
  });

  it("publishes mobile section navigation without warband selection", async () => {
    mocks.useMediaQuery.mockReturnValue(true);

    renderWithQueryClient(
      <BattleProvider phase="postbattle">
        <BattlePostbattle />
      </BattleProvider>
    );

    await waitFor(() => expect(mocks.setBattleMobileTopBar).toHaveBeenCalled());

    const topBarConfigs = mocks.setBattleMobileTopBar.mock.calls
      .map(([config]) => config)
      .filter(Boolean);
    const latestConfig = topBarConfigs[topBarConfigs.length - 1] as {
      title: string;
      warbandOptions?: unknown[];
      unitTypeOptions: Array<{ value: string }>;
      selectedUnitTypeValue: string;
      extraActions?: ReactNode;
    };

    expect(latestConfig.title).toBe("Postbattle");
    expect(latestConfig.warbandOptions).toBeUndefined();
    expect(latestConfig.selectedUnitTypeValue).toBe("exploration");
    expect(latestConfig.unitTypeOptions.map((option) => option.value)).toEqual([
      "exploration",
      "roster",
      "finds",
    ]);
    render(<>{latestConfig.extraActions}</>);
    expect(screen.getByRole("button", { name: "Battle Notes" })).toBeInTheDocument();
  });

  it("opens battle-styled postbattle dialogs", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <BattleProvider phase="postbattle">
        <BattlePostbattle />
      </BattleProvider>
    );

    await screen.findByRole("button", { name: "Serious Injury Roll" });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Serious Injury Roll" }));
    });
    expect(screen.getByRole("dialog")).toHaveClass("!rounded-none");
    expect(screen.getByRole("heading", { name: "Serious Injury Roll" })).toBeInTheDocument();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Close" }));
    });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Finalise Postbattle" }));
    });
    expect(screen.getByRole("dialog")).toHaveClass("!rounded-none");
    expect(screen.getByRole("heading", { name: "Finalise Postbattle" })).toBeInTheDocument();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Cancel" }));
    });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "More actions" }));
    });
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Skip postbattle" }));
    });
    expect(screen.getByRole("dialog")).toHaveClass("!rounded-none");
    expect(screen.getByRole("heading", { name: "Skip postbattle" })).toBeInTheDocument();
  });

  it("rolls the campaign's hero table for a hireling on it (a dramatis persona), as for a hero", async () => {
    const user = userEvent.setup();
    mocks.groups = [hirelingGroup("hero")];
    renderWithQueryClient(
      <BattleProvider phase="postbattle">
        <BattlePostbattle />
      </BattleProvider>
    );

    const roll = await screen.findByRole("button", { name: "Serious Injury Roll" });
    await act(async () => {
      await user.click(roll);
    });

    expect(screen.getByText("Roll a D66 guide for Bertha.")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByTestId("dice-roller-2d6")).toBeInTheDocument();
  });

  it("rolls a D6 for a hireling on the henchman table", async () => {
    const user = userEvent.setup();
    mocks.groups = [hirelingGroup("henchman")];
    renderWithQueryClient(
      <BattleProvider phase="postbattle">
        <BattlePostbattle />
      </BattleProvider>
    );

    const roll = await screen.findByRole("button", { name: "Serious Injury Roll" });
    await act(async () => {
      await user.click(roll);
    });

    expect(within(screen.getByRole("dialog")).getByTestId("dice-roller-1d6")).toBeInTheDocument();
  });

  it("suggests a one-battle hireling leaves, and dismisses him only when asked, saying his items go with him", async () => {
    const user = userEvent.setup();
    Object.assign(mocks.battleState, {
      suggested_postbattle: {
        unit_results: {},
        exploration: { dice_count: 0 },
        upkeep: { entries: {} },
        dismiss: { entries: { "hireling-1": { unit_name: "Bertha", reason: "stays_one_battle" } } },
      },
    });
    // The warband still has Bertha until she is dismissed.
    mocks.getWarbandSheet.mockResolvedValueOnce({
      summary: { resources: [{ id: 9, name: "Wyrdstone" }] },
      heroes: [],
      henchmen_groups: [],
      hirelings: [{ id: 201, name: "Bertha" }] as never[],
    });
    renderWithQueryClient(
      <BattleProvider phase="postbattle">
        <BattlePostbattle />
      </BattleProvider>
    );

    expect(
      await screen.findByText("Stays for one battle: suggested to leave now.")
    ).toBeInTheDocument();
    expect(mocks.deleteWarbandHireling).not.toHaveBeenCalled();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Dismiss Bertha" }));
    });
    expect(
      screen.getByText(
        "All items this unit carries are lost. Move them to the stash first to keep them."
      )
    ).toBeInTheDocument();
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Dismiss" }));
    });

    await waitFor(() => expect(mocks.deleteWarbandHireling).toHaveBeenCalledWith(3, 201));
    expect(await screen.findByText("Has left the warband.")).toBeInTheDocument();
    expect(mocks.finalizeBattlePostbattle).not.toHaveBeenCalled();
  });

  it("shows a suggested leaver the warband no longer has (dismissed before a reload) as gone, with no Dismiss", async () => {
    Object.assign(mocks.battleState, {
      suggested_postbattle: {
        unit_results: {},
        exploration: { dice_count: 0 },
        upkeep: { entries: {} },
        dismiss: { entries: { "hireling-1": { unit_name: "Bertha", reason: "stays_one_battle" } } },
      },
    });
    renderWithQueryClient(
      <BattleProvider phase="postbattle">
        <BattlePostbattle />
      </BattleProvider>
    );

    expect(await screen.findByText("Has left the warband.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss Bertha" })).toBeNull();
  });

  it("hides xp controls and xp awards for units that cannot gain xp", async () => {
    const user = userEvent.setup();
    mocks.groups = [
      {
        key: "hirelings",
        unitKind: "hireling",
        label: "Hired Swords",
        rows: [
          {
            unitKey: "hireling-1",
            unitName: "Ogre Bodyguard",
            unitType: "Hired Sword",
            unitKind: "hireling",
            canGainXp: false,
            injuryTable: "henchman",
            xpEarned: 3,
            killCount: 0,
            dead: false,
            outOfAction: false,
            groupName: "",
            specialIds: [],
            seriousInjuryRolls: [],
          },
        ],
      },
    ];

    renderWithQueryClient(
      <BattleProvider phase="postbattle">
        <BattlePostbattle />
      </BattleProvider>
    );

    await screen.findAllByText("Ogre Bodyguard");

    expect(screen.queryByText(/^XP$/)).not.toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Finalise Postbattle" }));
    });

    expect(screen.getByText("No XP awards are currently set.")).toBeInTheDocument();
  });

  it("searches and saves found items through the inline dropdown", async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <BattleProvider phase="postbattle">
        <BattlePostbattle />
      </BattleProvider>
    );

    await screen.findByTestId("battle-desktop-subnav");

    await act(async () => {
      await user.click(screen.getByPlaceholderText("Search and add an item"));
    });

    await waitFor(() => expect(mocks.listItems).toHaveBeenCalledTimes(1));
    expect(mocks.listItems).toHaveBeenCalledWith({
      campaignId: 1,
      signal: expect.any(AbortSignal),
    });

    await act(async () => {
      await user.type(screen.getByPlaceholderText("Search and add an item"), "Charm");
    });

    // Typing filters the loaded catalogue (PERF-40).
    expect(mocks.listItems).toHaveBeenCalledTimes(1);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /Lucky Charm/i }));
    });

    await waitFor(() => expect(mocks.saveBattlePostbattleDraft).toHaveBeenCalled());
    expect(mocks.saveBattlePostbattleDraft).toHaveBeenLastCalledWith(1, 2, {
      postbattle_json: {
        exploration: {
          dice_values: [],
          resource_id: null,
        },
        finds: {
          gold_crowns: 0,
          items: [
            {
              item_id: 77,
              name: "Lucky Charm",
              type: "Miscellaneous",
              cost: 15,
            },
          ],
        },
        upkeep: mocks.draft.upkeep,
        unit_results: mocks.draft.unit_results,
      },
    });
  });
});
