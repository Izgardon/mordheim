import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBattleRosters } from "./useBattleRosters";
import {
  BATTLE_ID,
  CAMPAIGN_ID,
  ME,
  OPPONENT,
  battleRosters,
  myParticipant,
  opponentParticipant,
} from "@/test/battle-fixtures";
import { createQueryWrapper } from "@/test/query-test-utils";

import type { BattleParticipant } from "@/features/battles/types/battle-types";

const api = vi.hoisted(() => ({ getBattleRosters: vi.fn(), getBattleState: vi.fn() }));
vi.mock("@/features/battles/api/battles-api", () => api);

const render = (participants?: BattleParticipant[]) =>
  renderHook(
    ({ list }: { list?: BattleParticipant[] }) => useBattleRosters(CAMPAIGN_ID, BATTLE_ID, list),
    { wrapper: createQueryWrapper(), initialProps: { list: participants } }
  );

describe("useBattleRosters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getBattleRosters.mockResolvedValue(battleRosters());
  });

  it("reads the rosters alongside the state, before the participants are known", async () => {
    const { result, rerender } = render(undefined);

    await waitFor(() => expect(api.getBattleRosters).toHaveBeenCalledTimes(1));
    expect(api.getBattleRosters).toHaveBeenCalledWith(CAMPAIGN_ID, BATTLE_ID);
    expect(result.current.rosters).toEqual({});

    // The state arrives and names the participants: the rosters already read are used.
    rerender({ list: [myParticipant(), opponentParticipant()] });
    await waitFor(() => expect(Object.keys(result.current.rosters)).toHaveLength(2));
    expect(result.current.rosterLoading).toEqual({ [ME.id]: false, [OPPONENT.id]: false });
    expect(api.getBattleRosters).toHaveBeenCalledTimes(1);
  });

  it("reads them again when the participants change", async () => {
    const { rerender } = render([myParticipant()]);
    await waitFor(() => expect(api.getBattleRosters).toHaveBeenCalledTimes(1));

    rerender({ list: [myParticipant(), opponentParticipant()] });

    await waitFor(() => expect(api.getBattleRosters).toHaveBeenCalledTimes(2));
  });
});
