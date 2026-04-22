import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BattleActive from "../BattleActive";

const mocks = vi.hoisted(() => {
  const createBattleState = () => ({
    battle: {
      id: 6,
      campaign_id: 1,
      created_by_user_id: 7,
      flow_type: "normal",
      status: "active",
      scenario: "Street Fight",
      scenario_link: null,
      winner_warband_ids_json: [],
      created_at: "",
      updated_at: "",
      started_at: null,
      ended_at: null,
      post_processed_at: null,
      channel: "battle",
    },
    participants: [
      {
        id: 21,
        battle_id: 6,
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
        selected_unit_keys_json: ["hero:1", "henchman:2"],
        unit_information_json: {},
        custom_units_json: [],
        postbattle_json: {},
        declared_rating: null,
        battle_notes: "",
        user: {
          id: 7,
          label: "Owner",
        },
        warband: {
          id: 101,
          name: "Iron Vultures",
        },
      },
      {
        id: 22,
        battle_id: 6,
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
        selected_unit_keys_json: ["hero:2"],
        unit_information_json: {},
        custom_units_json: [],
        postbattle_json: {},
        declared_rating: null,
        battle_notes: "",
        user: {
          id: 9,
          label: "Player",
        },
        warband: {
          id: 102,
          name: "Night Razors",
        },
      },
    ],
    events: [],
  });

  const rosters = {
    7: {
      heroes: [
        {
          key: "hero:1",
          id: 1,
          kind: "hero",
          displayName: "Captain Wolf",
          unitType: "Captain",
          stats: {
            movement: 4,
            weapon_skill: 4,
            ballistic_skill: 4,
            strength: 4,
            toughness: 3,
            wounds: 2,
            initiative: 4,
            attacks: 1,
            leadership: 8,
            armour_save: null,
          },
        },
      ],
      henchmenGroups: [
        {
          key: "group:1",
          id: 11,
          name: "Youngbloods",
          unitType: "Youngblood",
          stats: {
            movement: 4,
            weapon_skill: 2,
            ballistic_skill: 2,
            strength: 3,
            toughness: 3,
            wounds: 1,
            initiative: 3,
            attacks: 1,
            leadership: 6,
            armour_save: null,
          },
          members: [
            {
              key: "henchman:2",
              id: 2,
              kind: "henchman",
              displayName: "Youngblood A",
              unitType: "Youngblood",
              stats: {
                movement: 4,
                weapon_skill: 2,
                ballistic_skill: 2,
                strength: 3,
                toughness: 3,
                wounds: 1,
                initiative: 3,
                attacks: 1,
                leadership: 6,
                armour_save: null,
              },
            },
          ],
          singleUseItems: [],
          items: [],
          skills: [],
          spells: [],
          specialRules: [],
        },
      ],
      hiredSwords: [],
      warbandRating: null,
    },
    9: {
      heroes: [
        {
          key: "hero:2",
          id: 2,
          kind: "hero",
          displayName: "Black Fang",
          unitType: "Assassin",
          stats: {
            movement: 5,
            weapon_skill: 4,
            ballistic_skill: 4,
            strength: 3,
            toughness: 3,
            wounds: 1,
            initiative: 5,
            attacks: 1,
            leadership: 7,
            armour_save: null,
          },
        },
      ],
      henchmenGroups: [],
      hiredSwords: [],
      warbandRating: null,
    },
  };

  const pendingSaveResolvers: Array<() => void> = [];
  const buildConfigState = (payload: {
    selected_unit_keys_json: string[];
    unit_information_json: Record<string, unknown>;
    custom_units_json?: unknown[];
    battle_notes?: string;
  }) => {
    const battleState = createBattleState();
    return {
      ...battleState,
      participants: battleState.participants.map((participant) =>
        participant.user.id === 7
          ? {
              ...participant,
              selected_unit_keys_json:
                payload.selected_unit_keys_json ?? participant.selected_unit_keys_json,
              unit_information_json: payload.unit_information_json ?? participant.unit_information_json,
              custom_units_json: payload.custom_units_json ?? participant.custom_units_json,
              battle_notes: payload.battle_notes ?? participant.battle_notes,
            }
          : participant
      ),
    };
  };

  const saveBattleParticipantConfig = vi.fn(
    async (
      _campaignId: number,
      _battleId: number,
      payload: {
        selected_unit_keys_json: string[];
        unit_information_json: Record<string, unknown>;
        custom_units_json?: unknown[];
        battle_notes?: string;
      }
    ) =>
      await new Promise((resolve) => {
        pendingSaveResolvers.push(() => resolve(buildConfigState(payload)));
      })
  );

  return {
    createBattleState,
    rosters,
    navigate: vi.fn(),
    setBattleMobileTopBar: vi.fn(),
    getBattleState: vi.fn(async () => createBattleState()),
    saveBattleParticipantConfig,
    createBattleSessionSocket: vi.fn(() => ({ close: vi.fn() })),
    resolveNextSave: () => {
      pendingSaveResolvers.shift()?.();
    },
    resetPendingSaves: () => {
      pendingSaveResolvers.length = 0;
    },
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate-target">{to}</div>,
    useNavigate: () => mocks.navigate,
    useParams: () => ({ id: "1", battleId: "6" }),
    useOutletContext: () => ({
      setBattleMobileTopBar: mocks.setBattleMobileTopBar,
      setBattleMobileBottomBar: vi.fn(),
    }),
  };
});

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: 7 },
  }),
}));

vi.mock("@/lib/use-media-query", () => ({
  useMediaQuery: () => true,
}));

vi.mock("@/features/battles/api/battles-api", () => ({
  getBattleState: mocks.getBattleState,
  saveBattleParticipantConfig: mocks.saveBattleParticipantConfig,
  appendBattleEvent: vi.fn(),
  cancelBattleAsCreator: vi.fn(),
  finishBattle: vi.fn(),
  recordUnitKill: vi.fn(),
  setUnitOutOfAction: vi.fn(),
}));

vi.mock("@/lib/realtime", () => ({
  createBattleSessionSocket: mocks.createBattleSessionSocket,
}));

vi.mock("@/features/battles/hooks/useBattleRosters", () => ({
  useBattleRosters: () => ({
    rosters: mocks.rosters,
    rosterLoading: { 7: false, 9: false },
    rosterErrors: { 7: "", 9: "" },
  }),
}));

vi.mock("@/features/battles/components/shared/useBattleMobileBars", () => ({
  useBattleMobileTopBar: ({
    setBattleMobileTopBar,
    title,
    extraActions,
  }: {
    setBattleMobileTopBar?: (config: { title: string; extraActions?: ReactNode } | null) => void;
    title: string;
    extraActions?: ReactNode;
  }) => {
    setBattleMobileTopBar?.({ title, extraActions });
    return { sectionIdByKey: {} };
  },
  useBattleMobileBottomBar: () => undefined,
}));

vi.mock("@/features/battles/components/active/ActiveParticipantRoster", () => ({
  default: ({
    participantRoster,
    unitInformationByKey,
    onAdjustWounds,
  }: {
    participantRoster: {
      heroes: Array<{
        key: string;
        displayName: string;
        kind: string;
        unitType: string;
        stats: Record<string, number | null>;
      }>;
      henchmenGroups: Array<{
        members: Array<{
          key: string;
          displayName: string;
          kind: string;
          unitType: string;
          stats: Record<string, number | null>;
        }>;
      }>;
    };
    unitInformationByKey: Record<string, { current_wounds?: number | null; stats_override?: unknown }>;
    onAdjustWounds: (unit: {
      key: string;
      displayName: string;
      kind: string;
      unitType: string;
      stats: Record<string, number | null>;
    }, delta: number) => void;
  }) => {
    const hero = participantRoster.heroes[0];
    const henchman = participantRoster.henchmenGroups[0]?.members[0];
    if (!hero || !henchman) {
      return null;
    }
    return (
      <div>
        <div>Active roster</div>
        <div>Hero wounds:{String(unitInformationByKey[hero.key]?.current_wounds ?? "base")}</div>
        <div>Henchman wounds:{String(unitInformationByKey[henchman.key]?.current_wounds ?? "base")}</div>
        <button type="button" onClick={() => onAdjustWounds(hero, -1)}>
          Hero -1
        </button>
        <button type="button" onClick={() => onAdjustWounds(henchman, 1)}>
          Hench +1
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/ui/loading-screen", () => ({
  LoadingScreen: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("@/features/battles/components/active/ActiveBattleHelpers", () => ({
  default: () => <div>Helpers</div>,
}));

vi.mock("@/features/battles/components/active/ActiveCriticalHitDialog", () => ({
  default: () => null,
}));

vi.mock("@/features/battles/components/active/ActiveMeleeDialog", () => ({
  default: () => null,
}));

vi.mock("@/features/battles/components/active/ActiveRangedDialog", () => ({
  default: () => null,
}));

vi.mock("@/features/battles/components/prebattle/PrebattleCustomUnitBuilder", () => ({
  default: () => null,
}));

vi.mock("@/features/warbands/components/warband/WarbandPdfViewerDialog", () => ({
  default: () => null,
}));

vi.mock("@/features/battles/components/shared/BattleNotesDialog", () => ({
  default: () => null,
}));

describe("BattleActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetPendingSaves();
  });

  it("publishes a mobile top bar action for Battle Notes on the current user's warband", async () => {
    render(<BattleActive />);

    await screen.findByText("Active roster");

    await waitFor(() => {
      expect(mocks.setBattleMobileTopBar).toHaveBeenCalled();
    });

    const latestConfig = mocks.setBattleMobileTopBar.mock.calls.at(-1)?.[0] as {
      title: string;
      extraActions?: ReactNode;
    };

    expect(latestConfig.title).toBe("In Battle");
    render(<>{latestConfig.extraActions}</>);

    expect(screen.getByRole("button", { name: "Battle Notes" })).toBeInTheDocument();
  });

  it("queues rapid wound updates and saves the final hero current_wounds snapshot", async () => {
    const user = userEvent.setup();

    render(<BattleActive />);

    await screen.findByText("Active roster");

    await user.click(screen.getByRole("button", { name: "Hero -1" }));
    await user.click(screen.getByRole("button", { name: "Hero -1" }));

    expect(screen.getByText("Hero wounds:0")).toBeInTheDocument();
    expect(mocks.saveBattleParticipantConfig).toHaveBeenCalledTimes(1);

    await act(async () => {
      mocks.resolveNextSave();
    });

    await waitFor(() => {
      expect(mocks.saveBattleParticipantConfig).toHaveBeenCalledTimes(2);
    });

    const secondPayload = mocks.saveBattleParticipantConfig.mock.calls[1]?.[2] as {
      unit_information_json: Record<
        string,
        { current_wounds?: number | null; stats_override?: Record<string, unknown> }
      >;
    };
    expect(secondPayload.unit_information_json["hero:1"]?.current_wounds).toBe(0);
    expect(secondPayload.unit_information_json["hero:1"]?.stats_override?.wounds).toBeUndefined();

    await act(async () => {
      mocks.resolveNextSave();
    });
  });

  it("stores henchman wound changes in current_wounds instead of stats_override", async () => {
    const user = userEvent.setup();

    render(<BattleActive />);

    await screen.findByText("Active roster");

    await user.click(screen.getByRole("button", { name: "Hench +1" }));
    await user.click(screen.getByRole("button", { name: "Hench +1" }));

    expect(screen.getByText("Henchman wounds:3")).toBeInTheDocument();
    expect(mocks.saveBattleParticipantConfig).toHaveBeenCalledTimes(1);

    await act(async () => {
      mocks.resolveNextSave();
    });

    await waitFor(() => {
      expect(mocks.saveBattleParticipantConfig).toHaveBeenCalledTimes(2);
    });

    const secondPayload = mocks.saveBattleParticipantConfig.mock.calls[1]?.[2] as {
      unit_information_json: Record<
        string,
        { current_wounds?: number | null; stats_override?: Record<string, unknown> }
      >;
    };
    expect(secondPayload.unit_information_json["henchman:2"]?.current_wounds).toBe(3);
    expect(secondPayload.unit_information_json["henchman:2"]?.stats_override?.wounds).toBeUndefined();

    await act(async () => {
      mocks.resolveNextSave();
    });
  });
});
