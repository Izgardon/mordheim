import { describe, expect, it } from "vitest";

import { participantProgress } from "./participant-progress";

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
});
