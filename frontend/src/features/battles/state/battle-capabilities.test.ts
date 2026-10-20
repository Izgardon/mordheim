import { describe, expect, it } from "vitest";

import { battleState } from "@/test/battle-fixtures";

import { capabilityBasis, readCapabilities } from "./battle-capabilities";
import { mergeBattleState } from "./battle-cache";

const CAN_END = {
  start: false,
  end: true,
  cancel: true,
  close_postbattle: false,
  edit_record: false,
};

describe("battle capabilities", () => {
  it("keeps a read's capabilities through writes and messages that change no status", () => {
    const read = mergeBattleState(null, {
      ...battleState({ status: "active" }),
      capabilities: CAN_END,
    });
    expect(read.capabilitiesBasis).toBe(capabilityBasis(read));
    expect(readCapabilities(read)).toEqual({ capabilities: CAN_END, stale: false });

    // A kill's answer: no capabilities, same statuses.
    const afterWrite = mergeBattleState(read, battleState({ status: "active" }));
    expect(readCapabilities(afterWrite)).toEqual({ capabilities: CAN_END, stale: false });
  });

  it("turns every control off once a status moves on, until the next read", () => {
    const read = mergeBattleState(null, {
      ...battleState({ status: "active" }),
      capabilities: CAN_END,
    });
    const ended = mergeBattleState(read, battleState({ status: "postbattle" }));
    expect(readCapabilities(ended)).toEqual({
      capabilities: {
        start: false,
        end: false,
        cancel: false,
        close_postbattle: false,
        edit_record: false,
      },
      stale: true,
    });

    const closeable = { ...CAN_END, end: false, cancel: false, close_postbattle: true };
    const reread = mergeBattleState(ended, {
      ...battleState({ status: "postbattle" }),
      capabilities: closeable,
    });
    expect(readCapabilities(reread)).toEqual({ capabilities: closeable, stale: false });
  });

  it("says when the server sent none, so the pages' own rules apply", () => {
    expect(readCapabilities(battleState({ status: "active" }))).toEqual({
      capabilities: null,
      stale: false,
    });
  });

  it("keeps the cached capabilities when an older read lands", () => {
    const newer = mergeBattleState(null, {
      ...battleState({ status: "postbattle", state_version: 5 }),
      capabilities: { ...CAN_END, close_postbattle: true },
    });
    const older = mergeBattleState(newer, {
      ...battleState({ status: "active", state_version: 4 }),
      capabilities: CAN_END,
    });
    expect(readCapabilities(older).capabilities?.close_postbattle).toBe(true);
  });
});
