import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BattlePrebattle from "../BattlePrebattle";

const mocks = vi.hoisted(() => {
  const battleState = {
    battle: {
      id: 5,
      campaign_id: 1,
      created_by_user_id: 7,
      flow_type: "normal",
      status: "prebattle",
      scenario: "Wyrdstone Hunt",
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
        id: 11,
        battle_id: 5,
        status: "joined_prebattle",
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
        selected_unit_keys_json: [],
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
        id: 12,
        battle_id: 5,
        status: "joined_prebattle",
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
        selected_unit_keys_json: [],
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
  };

  const rosters = {
    7: {
      heroes: [
        {
          key: "hero:1",
          id: 1,
          kind: "hero",
          displayName: "Captain Wolf",
          unitType: "Captain",
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
          rating: 55,
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

  return {
    battleState,
    rosters,
    navigate: vi.fn(),
    getBattleState: vi.fn(async () => battleState),
    saveBattleParticipantConfig: vi.fn(async (_campaignId, _battleId, payload) => ({
      ...battleState,
      participants: battleState.participants.map((participant) =>
        participant.user.id === 7
          ? {
              ...participant,
              battle_notes: payload.battle_notes ?? participant.battle_notes,
            }
          : participant
      ),
    })),
    setBattleReady: vi.fn(),
    joinBattle: vi.fn(),
    startBattle: vi.fn(),
    appendBattleEvent: vi.fn(),
    cancelBattleAsCreator: vi.fn(),
    createBattleSessionSocket: vi.fn(() => ({ close: vi.fn() })),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate-target">{to}</div>,
    useNavigate: () => mocks.navigate,
    useParams: () => ({ id: "1", battleId: "5" }),
    useOutletContext: () => ({
      campaign: { name: "Campaign" },
      setBattleMobileTopBar: vi.fn(),
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
  useMediaQuery: () => false,
}));

vi.mock("@/features/battles/api/battles-api", () => ({
  getBattleState: mocks.getBattleState,
  saveBattleParticipantConfig: mocks.saveBattleParticipantConfig,
  setBattleReady: mocks.setBattleReady,
  joinBattle: mocks.joinBattle,
  startBattle: mocks.startBattle,
  appendBattleEvent: mocks.appendBattleEvent,
  cancelBattleAsCreator: mocks.cancelBattleAsCreator,
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

vi.mock("@/features/battles/components/prebattle/usePrebattleMobileBars", () => ({
  usePrebattleMobileTopBar: () => ({ sectionIdByKey: {} }),
  usePrebattleMobileBottomBar: () => undefined,
}));

vi.mock("@/features/battles/components/prebattle/PrebattleParticipantRoster", () => ({
  default: ({ participant }: { participant: { warband: { name: string } } }) => (
    <div>Roster for {participant.warband.name}</div>
  ),
}));

vi.mock("@/components/ui/loading-screen", () => ({
  LoadingScreen: ({ message }: { message: string }) => <div>{message}</div>,
}));

vi.mock("@/features/battles/components/prebattle/PrebattleActionBar", () => ({
  default: () => null,
}));

vi.mock("@/features/battles/components/prebattle/PrebattleCustomUnitBuilder", () => ({
  default: () => null,
}));

vi.mock("@/features/battles/components/prebattle/PrebattleDialogs", () => ({
  default: () => null,
}));

vi.mock("@/features/battles/components/prebattle/PrebattleInviteGate", () => ({
  default: () => null,
}));

vi.mock("@/features/warbands/components/warband/WarbandPdfViewerDialog", () => ({
  default: () => null,
}));

vi.mock("@/features/battles/components/shared/BattleDesktopSubnav", () => ({
  default: ({
    participants,
    onSelectParticipant,
    actions,
  }: {
    participants: Array<{ user: { id: number }; warband: { name: string } }>;
    onSelectParticipant: (userId: number) => void;
    actions?: ReactNode;
  }) => (
    <div>
      {participants.map((participant) => (
        <button
          key={participant.user.id}
          type="button"
          onClick={() => onSelectParticipant(participant.user.id)}
        >
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
      <button type="button" onClick={() => void onSave("Updated battle note")}>
        Save battle notes
      </button>
    ) : null,
}));

describe("BattlePrebattle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Battle Notes only for the current user's selected warband and saves through participant config", async () => {
    const user = userEvent.setup();

    render(<BattlePrebattle />);

    await screen.findByText("Roster for Iron Vultures");

    expect(screen.getByRole("button", { name: "Battle Notes" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Battle Notes" }));
    await user.click(screen.getByRole("button", { name: "Save battle notes" }));

    await waitFor(() => {
      expect(mocks.saveBattleParticipantConfig).toHaveBeenCalledWith(
        1,
        5,
        expect.objectContaining({
          battle_notes: "Updated battle note",
        })
      );
    });

    await user.click(screen.getByRole("button", { name: "Night Razors" }));

    expect(screen.getByText("Roster for Night Razors")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Battle Notes" })).not.toBeInTheDocument();
  });
});
