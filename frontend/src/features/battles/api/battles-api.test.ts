import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  appendBattleEvent,
  approveReportedBattleResult,
  cancelBattleAsCreator,
  cancelBattlePrebattle,
  closePostbattle,
  confirmBattlePostbattle,
  createBattle,
  declineBattleInvite,
  declineReportedBattleResult,
  finalizeBattlePostbattle,
  finishBattle,
  getBattleRosters,
  getBattleState,
  joinBattle,
  listOpenCampaignBattles,
  recordUnitKill,
  reportBattleResult,
  saveBattleParticipantConfig,
  saveBattlePostbattleDraft,
  setBattleReady,
  setUnitOutOfAction,
  startBattle,
  voidBattleEvent,
  withdrawReportedBattleResult,
} from "./battles-api";
import type {
  BattleCreatePayload,
  BattlePostbattleState,
  ReportBattleResultPayload,
} from "../types/battle-types";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(async () => ({})),
  socketId: null as string | null,
}));

vi.mock("@/lib/api-client", () => ({ apiRequest: mocks.apiRequest }));
vi.mock("@/lib/realtime/client", () => ({ realtimeSocketId: () => mocks.socketId }));

const lastCall = () => {
  const calls = mocks.apiRequest.mock.calls as unknown as [
    string,
    { method?: string; headers?: unknown } | undefined,
  ][];
  return calls[calls.length - 1];
};

const draft = {} as BattlePostbattleState;

describe("battles-api: battle writes name this browser's socket (BUG-75)", () => {
  beforeEach(() => {
    mocks.apiRequest.mockClear();
    mocks.socketId = "123.456";
  });

  it("sends X-Pusher-Socket-Id on every battle write, so the server skips only this tab", async () => {
    const writes = [
      () => createBattle(1, {} as BattleCreatePayload),
      () => reportBattleResult(1, {} as ReportBattleResultPayload),
      () => joinBattle(1, 5),
      () => declineBattleInvite(1, 5),
      () => saveBattleParticipantConfig(1, 5, { battle_notes: "" }),
      () => setBattleReady(1, 5, true),
      () => cancelBattlePrebattle(1, 5),
      () => cancelBattleAsCreator(1, 5),
      () => startBattle(1, 5),
      () => appendBattleEvent(1, 5, { type: "item_used" }),
      () => setUnitOutOfAction(1, 5, { unit_key: "hero:1", out_of_action: true }),
      () => recordUnitKill(1, 5, { killer_unit_key: "hero:1", earned_xp: true }),
      () => finishBattle(1, 5, { winner_warband_ids: [101] }),
      () => approveReportedBattleResult(1, 5),
      () => declineReportedBattleResult(1, 5),
      () => withdrawReportedBattleResult(1, 5),
      () => saveBattlePostbattleDraft(1, 5, { postbattle_json: draft }),
      () => finalizeBattlePostbattle(1, 5, { postbattle_json: draft }),
      () => confirmBattlePostbattle(1, 5),
      () => closePostbattle(1, 5),
      () => voidBattleEvent(1, 5, 9),
    ];
    for (const write of writes) {
      await write();
      const [path, options] = lastCall();
      expect(options?.method, path).toBe("POST");
      expect(options?.headers, path).toEqual({ "X-Pusher-Socket-Id": "123.456" });
    }
  });

  it("sends no header before the realtime connection has a socket, and none on reads", async () => {
    mocks.socketId = null;
    await recordUnitKill(1, 5, { killer_unit_key: "hero:1", earned_xp: true });
    expect(lastCall()[1]?.headers).toBeUndefined();

    mocks.socketId = "123.456";
    for (const read of [
      () => getBattleState(1, 5, { view: "active" }),
      () => getBattleRosters(1, 5),
      () => listOpenCampaignBattles(1),
    ]) {
      await read();
      expect(lastCall()[1]?.headers).toBeUndefined();
    }
  });
});
