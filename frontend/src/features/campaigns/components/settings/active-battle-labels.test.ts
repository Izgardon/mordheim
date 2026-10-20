import { describe, expect, it } from "vitest";

import { idleDuration } from "@/features/battles/utils/battle-timing";
import { battleState } from "@/test/battle-fixtures";
import { battleStatusLine, stuckBattlesSummary } from "./active-battle-labels";

import type { CampaignActiveBattle } from "../../types/campaign-types";

const DAY = 86_400;
const row = (idle: number, stuck: boolean): CampaignActiveBattle => {
  const { battle, participants } = battleState({ status: "active" });
  return { battle, participants, idle_seconds: idle, stuck };
};

describe("idleDuration", () => {
  it("counts whole days, then whole hours, and nothing under an hour", () => {
    expect(idleDuration(5 * DAY + 3600)).toBe("5 days");
    expect(idleDuration(DAY)).toBe("1 day");
    expect(idleDuration(2 * 3600 + 59)).toBe("2 hours");
    expect(idleDuration(1800)).toBeNull();
    expect(idleDuration(null)).toBeNull();
  });
});

describe("stuckBattlesSummary", () => {
  it("says nothing when no battle is stuck", () => {
    expect(stuckBattlesSummary([row(3600, false)])).toBeNull();
    expect(stuckBattlesSummary([])).toBeNull();
  });

  it("names one stuck battle's idle time, or the longest of several", () => {
    expect(stuckBattlesSummary([row(5 * DAY, true), row(9 * DAY, false)])).toBe(
      "1 battle idle for 5 days"
    );
    expect(stuckBattlesSummary([row(2 * DAY, true), row(6 * DAY, true)])).toBe(
      "2 battles idle, the longest for 6 days"
    );
  });
});

describe("battleStatusLine", () => {
  it("prefers the server's idle seconds to the battle's last write", () => {
    const { battle } = row(0, false);
    battle.last_activity_at = new Date(Date.now() - 3 * 3_600_000).toISOString();

    expect(battleStatusLine(battle, 2 * DAY)).toBe("Active · idle 2 days");
    expect(battleStatusLine(battle)).toBe("Active · idle 3 hours");
  });
});
