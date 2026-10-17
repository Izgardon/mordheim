import { describe, expect, it } from "vitest";

import { lockErrorMessage, tradeFromError } from "./trade-errors";
import { ApiError } from "@/lib/api-client";

import type { TradeRequest } from "../types/trade-request-types";

const trade = { id: "t-1", status: "accepted", offer_version: 4 } as TradeRequest;

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

  it("falls back to the server's message", () => {
    expect(
      lockErrorMessage(new ApiError("Trade is not active", 400, { detail: "Trade is not active" }))
    ).toBe("Trade is not active");
  });
});
