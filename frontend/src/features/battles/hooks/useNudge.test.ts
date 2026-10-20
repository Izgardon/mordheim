import { describe, expect, it } from "vitest";

import { ME, OPPONENT, battleEvent } from "@/test/battle-fixtures";

import { NUDGE_GAP_MS, nudgeWaitMs } from "./useNudge";

const nudgeAt = (iso: string, by = ME.id, target = OPPONENT.id) => ({
  ...battleEvent(1, "participant_nudged", by, { target_user_id: target, nudged_by_user_id: by }),
  created_at: iso,
});

describe("nudgeWaitMs", () => {
  it("counts ten minutes from your last nudge of that player", () => {
    const now = Date.parse("2026-10-19T10:04:00Z");
    expect(nudgeWaitMs([nudgeAt("2026-10-19T10:00:00Z")], ME.id, OPPONENT.id, now)).toBe(
      NUDGE_GAP_MS - 4 * 60_000
    );
    expect(nudgeWaitMs([nudgeAt("2026-10-19T09:40:00Z")], ME.id, OPPONENT.id, now)).toBe(0);
    // Someone else's nudge, or of someone else, doesn't count against you.
    expect(nudgeWaitMs([nudgeAt("2026-10-19T10:00:00Z", 12)], ME.id, OPPONENT.id, now)).toBe(0);
    expect(nudgeWaitMs([nudgeAt("2026-10-19T10:00:00Z", ME.id, 12)], ME.id, OPPONENT.id, now)).toBe(
      0
    );
  });
});
