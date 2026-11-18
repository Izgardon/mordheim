/**
 * What the aftermath has handed over, as the page reads the server's record (William, 18 Nov 2026:
 * "maybe we can lock the item and gold section, the number of wyrdstone received but still allow
 * the other things to be edited and dice numbers to change for exploration purposes").
 */
import { describe, expect, it } from "vitest";

import type { BattlePostbattleState } from "@/features/battles/types/battle-types";

import { NO_LOCKS, aftermathLocks, receivedLine } from "./aftermath-locks";

const draft = (aftermath?: BattlePostbattleState["aftermath"]): BattlePostbattleState => ({
  exploration: { dice_values: [], resource_id: null },
  finds: { gold_crowns: 0, items: [] },
  upkeep: { pay_upkeep: true, entries: {} },
  unit_results: {},
  ...(aftermath ? { aftermath } : {}),
});

describe("aftermathLocks", () => {
  it("locks nothing before a step is applied, and for a draft that has no record yet", () => {
    expect(aftermathLocks(null)).toEqual(NO_LOCKS);
    expect(aftermathLocks(draft())).toEqual(NO_LOCKS);
  });

  it("reads which steps are in the warband, whether the aftermath is done and what it gave", () => {
    const locks = aftermathLocks(
      draft({
        applied: ["injuries", "explore"],
        done_at: "2026-11-18T10:00:00Z",
        received: { shards: 5, resource: "Wyrdstone", gold: 20, items: 1 },
      })
    );

    expect(locks).toMatchObject({ injuries: true, xp: false, explore: true, done: true });
    expect(locks.applied).toEqual(["injuries", "explore"]);
  });

  it("is not done while the explore step is still open", () => {
    const locks = aftermathLocks(draft({ applied: ["injuries"], done_at: null, received: {} }));

    expect(locks.done).toBe(false);
    expect(locks.injuries).toBe(true);
  });
});

describe("receivedLine", () => {
  it("names the shards, gold and items handed over", () => {
    expect(receivedLine({ shards: 5, resource: "Wyrdstone", gold: 20, items: 2 })).toBe(
      "5 Wyrdstone, 20 gc and 2 items"
    );
    expect(receivedLine({ shards: 1, resource: null, gold: 0, items: 1 })).toBe(
      "1 shard and 1 item"
    );
    expect(receivedLine({ gold: 20 })).toBe("20 gc");
    expect(receivedLine({})).toBe("Nothing was found");
  });
});
