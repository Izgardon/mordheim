import { describe, expect, it } from "vitest";

import { deadlineLabel, idleLabel } from "./battle-timing";

const NOW = Date.parse("2026-10-18T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const ahead = (ms: number) => new Date(NOW + ms).toISOString();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("battle-timing (BUG-10, decision 2)", () => {
  it("says how long a battle has been idle, in days, then hours, and nothing under an hour", () => {
    expect(idleLabel(ago(6 * DAY + HOUR), NOW)).toBe("idle 6 days");
    expect(idleLabel(ago(DAY), NOW)).toBe("idle 1 day");
    expect(idleLabel(ago(3 * HOUR), NOW)).toBe("idle 3 hours");
    expect(idleLabel(ago(10 * 60_000), NOW)).toBeNull();
    expect(idleLabel(null, NOW)).toBeNull();
  });

  it("says when invites or a postbattle close, and Overdue once past", () => {
    const at = { now: NOW };
    expect(deadlineLabel({ status: "inviting", closes_at: ahead(2 * DAY + HOUR) }, at)).toBe(
      "Invites close in 2 days"
    );
    expect(deadlineLabel({ status: "postbattle", closes_at: ahead(5 * HOUR) }, at)).toBe(
      "Postbattle closes in 5 hours"
    );
    expect(
      deadlineLabel({ status: "postbattle", closes_at: ahead(5 * HOUR) }, { ...at, short: true })
    ).toBe("closes in 5 hours");
    expect(deadlineLabel({ status: "postbattle", closes_at: ahead(HOUR / 2) }, at)).toBe(
      "Postbattle closes within the hour"
    );
    expect(deadlineLabel({ status: "postbattle", closes_at: ago(HOUR) }, at)).toBe("Overdue");
    expect(deadlineLabel({ status: "inviting", closes_at: ahead(DAY), overdue: true }, at)).toBe(
      "Overdue"
    );
    expect(deadlineLabel({ status: "active", closes_at: null }, at)).toBeNull();
  });
});
