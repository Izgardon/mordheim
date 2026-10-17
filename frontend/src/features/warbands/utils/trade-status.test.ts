import { describe, expect, it } from "vitest";

import { describeTradeEnd, isTradeOver } from "./trade-status";

import type { TradeRequest } from "../types/trade-request-types";

const trade = (status: TradeRequest["status"]) =>
  ({
    id: "t-1",
    status,
    from_user: { id: 1, label: "Ann" },
    to_user: { id: 2, label: "Bob" },
  }) as TradeRequest;

describe("trade-status", () => {
  it("treats declined, cancelled, expired and completed as over", () => {
    expect(
      ["declined", "cancelled", "expired", "completed"].map((s) =>
        isTradeOver(trade(s as TradeRequest["status"]))
      )
    ).toEqual([true, true, true, true]);
    expect(isTradeOver(trade("pending"))).toBe(false);
    expect(isTradeOver(trade("accepted"))).toBe(false);
  });

  it("says a cancel (the sender closing) apart from a decline (BUG-115)", () => {
    expect(describeTradeEnd(trade("cancelled"), 2)).toBe("Ann cancelled the trade.");
    expect(describeTradeEnd(trade("cancelled"), 1)).toBe("You cancelled the trade.");
    expect(describeTradeEnd(trade("declined"), 1)).toBe("Bob declined the trade.");
    expect(describeTradeEnd(trade("declined"), 2)).toBe("You declined the trade.");
  });

  it("says expiry and completion, and nothing for an open trade", () => {
    expect(describeTradeEnd(trade("expired"), 1)).toBe("The trade request expired.");
    expect(describeTradeEnd(trade("completed"), 1)).toBe("The trade is complete.");
    expect(describeTradeEnd(trade("accepted"), 1)).toBeNull();
  });
});
