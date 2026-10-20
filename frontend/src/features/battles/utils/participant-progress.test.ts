import { describe, expect, it } from "vitest";

import { myParticipant, opponentParticipant } from "@/test/battle-fixtures";

import { battleProgress, participantProgress } from "./participant-progress";

describe("participant progress", () => {
  it("says who each phase waits for", () => {
    expect(participantProgress({ status: "invited" }, "inviting")).toEqual({
      label: "Invited",
      tone: "waiting",
    });
    expect(participantProgress({ status: "accepted" }, "inviting").tone).toBe("done");
    expect(participantProgress({ status: "joined_prebattle" }, "prebattle")).toEqual({
      label: "Not ready",
      tone: "waiting",
    });
    expect(participantProgress({ status: "ready" }, "prebattle").label).toBe("Ready");
    // Decision 4: the battle waits for those still fighting; the others say how it went.
    expect(participantProgress({ status: "in_battle" }, "active")).toEqual({
      label: "In battle",
      tone: "waiting",
    });
    expect(
      participantProgress({ status: "finished_battle", declared_result: "lost" }, "active")
    ).toEqual({ label: "Finished: lost", tone: "done" });
    expect(participantProgress({ status: "finished_battle" }, "postbattle")).toEqual({
      label: "In postbattle",
      tone: "waiting",
    });
    expect(participantProgress({ status: "confirmed_postbattle" }, "postbattle").label).toBe(
      "Finished"
    );
    expect(
      participantProgress({ status: "confirmed_postbattle", skipped_postbattle: true }, "ended")
        .label
    ).toBe("Skipped");
  });

  it("leaves out players who declined or left, and gives each one's idle time", () => {
    const now = Date.parse("2026-10-18T15:00:00Z");
    const entries = battleProgress(
      [
        myParticipant({
          status: "finished_battle",
          last_seen_at: "2026-10-18T09:00:00Z",
          // Their last write counts too, so a recent one isn't idle (BATL-NEW-08).
          last_activity_at: "2026-10-18T14:30:00Z",
        }),
        opponentParticipant({ status: "finished_battle", last_seen_at: "2026-10-18T11:00:00Z" }),
        opponentParticipant({ id: 23, status: "declined" }),
      ],
      "postbattle",
      now
    );
    expect(
      entries.map((entry) => [entry.participant.id, entry.progress.label, entry.idle])
    ).toEqual([
      [21, "In postbattle", null],
      [22, "In postbattle", "idle 4 hours"],
    ]);
  });
});
