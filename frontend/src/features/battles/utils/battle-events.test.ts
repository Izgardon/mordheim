import { describe, expect, it } from "vitest";

import { ME, OPPONENT, battleEvent } from "@/test/battle-fixtures";
import {
  latestItemUseEvent,
  liveKillEvents,
  newestOwnEvent,
  usedSingleUseItemCounts,
} from "./battle-events";

const voided = <T extends object>(event: T) => ({ ...event, voided_at: "2026-10-18T11:00:00Z" });

const kill = (id: number, unitKey: string, actor = ME.id) =>
  battleEvent(id, "unit_kill_recorded", actor, { killer: { unit_key: unitKey } });

const use = (id: number, unitKey: string, itemId: number) =>
  battleEvent(id, "item_used", ME.id, { unit_key: unitKey, item_id: itemId });

describe("battle-events (BUG-11)", () => {
  it("counts a unit's kills that still count, and only the player's own", () => {
    const events = [
      kill(1, "hero:1"),
      voided(kill(2, "hero:1")),
      kill(3, "hero:3"),
      kill(4, "hero:1"),
    ];

    expect(liveKillEvents(events, "hero:1", ME.id).map((event) => event.id)).toEqual([1, 4]);
    expect(liveKillEvents([kill(5, "hero:2", OPPONENT.id)], "hero:2", ME.id)).toEqual([]);
  });

  it("leaves undone item uses out of the counts and finds the latest one to undo", () => {
    const events = [use(1, "hero:1", 40), use(2, "hero:1", 40), voided(use(3, "hero:1", 40))];

    expect(usedSingleUseItemCounts(events)).toEqual({ "hero:1": { 40: 2 } });
    expect(latestItemUseEvent(events, "hero:1", 40, ME.id)?.id).toBe(2);
    expect(latestItemUseEvent(events, "hero:1", 41, ME.id)).toBeNull();
    expect(newestOwnEvent(events, "item_used", ME.id)?.id).toBe(3);
  });
});
