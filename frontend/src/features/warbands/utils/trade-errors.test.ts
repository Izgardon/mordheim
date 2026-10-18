import { describe, expect, it } from "vitest";

import {
  completionFailureMessage,
  lockErrorMessage,
  offerErrorMessage,
  openTradeIdFromError,
  tradeFromError,
} from "./trade-errors";
import { ApiError } from "@/lib/api-client";

import type { TradeRequest } from "../types/trade-request-types";

const trade = {
  id: "t-1",
  status: "accepted",
  offer_version: 4,
  from_warband: { id: 9, name: "The Black Wolves" },
  to_warband: { id: 12, name: "Reikland Rats" },
} as TradeRequest;

const partnerLeft = new ApiError("The other player is no longer in this campaign.", 409, {
  detail: "The other player is no longer in this campaign.",
  code: "trade_partner_left",
});

describe("trade-errors", () => {
  it("reads the trade a refused write answers with, and nothing from other errors", () => {
    expect(tradeFromError(new ApiError("Changed", 409, { code: "offer_changed", trade }))).toBe(
      trade
    );
    expect(tradeFromError(new ApiError("Nope", 400, { detail: "Nope" }))).toBeNull();
    expect(tradeFromError(new Error("Network"))).toBeNull();
  });

  it("says the offer changed for a lock on an older version (BUG-35)", () => {
    expect(lockErrorMessage(new ApiError("Changed", 409, { code: "offer_changed", trade }))).toBe(
      "The other side changed the offer. Check it and accept again."
    );
  });

  it("names the warband whose side stopped a completion", () => {
    expect(completionFailureMessage({ detail: "Not enough gold.", warband_id: 12 }, trade)).toBe(
      "The trade couldn't complete: Reikland Rats: Not enough gold. Both sides are unlocked."
    );
    expect(completionFailureMessage({ detail: "Not enough gold." }, null)).toBe(
      "The trade couldn't complete: Not enough gold. Both sides are unlocked."
    );
  });

  it("says backing out still works when the other player left (SEC-08)", () => {
    const expected =
      "The other player is no longer in this campaign. You can still unaccept or cancel the trade.";
    expect(lockErrorMessage(partnerLeft)).toBe(expected);
    expect(offerErrorMessage(partnerLeft)).toBe(expected);
  });

  it("reads the open trade's id from a refused request (BUG-114)", () => {
    const refused = new ApiError("Open", 409, { code: "trade_already_open", trade_id: "t-7" });
    expect(openTradeIdFromError(refused)).toBe("t-7");
    expect(openTradeIdFromError(partnerLeft)).toBeNull();
  });

  it("falls back to the server's message", () => {
    expect(
      lockErrorMessage(new ApiError("Trade is not active", 400, { detail: "Trade is not active" }))
    ).toBe("Trade is not active");
  });
});
