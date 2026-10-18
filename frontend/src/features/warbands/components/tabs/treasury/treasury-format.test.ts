import { describe, expect, it } from "vitest";

import {
  badgeClass,
  formatRowDate,
  formatSignedAmount,
  formatTradeAction,
  rowAmount,
  rowTotal,
} from "./treasury-format";

import type { WarbandTrade } from "../../../types/warband-types";

const row = (overrides: Partial<WarbandTrade>): WarbandTrade => ({
  id: 1,
  warband_id: 9,
  parent_id: null,
  action: "Sell",
  description: "Sword",
  price: 5,
  notes: "",
  children: [],
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
  ...overrides,
});

const child = (id: number, action: string, price: number) => ({
  id,
  action,
  description: `Row ${id}`,
  price,
  notes: "",
  created_at: "2026-10-02T10:00:00Z",
});

describe("treasury rows", () => {
  it("read each row's amount as the server signs it, whatever its action (decision 4)", () => {
    expect(rowAmount({ price: -5 })).toBe(-5);
    expect(rowAmount({ price: 5 })).toBe(5);
    // Gold sent in a trade, and an adjustment that took gold away.
    expect(rowAmount(row({ action: "Trade", price: -30 }))).toBe(-30);
    expect(rowAmount(row({ action: "Adjustment", price: -15 }))).toBe(-15);
  });

  it("total a group by its children, not by its own action (BUG-38)", () => {
    const recruits = row({
      action: "Group",
      price: 0,
      children: [child(2, "Recruit", -60), child(3, "Recruit", -60)],
    });
    expect(rowTotal(recruits)).toBe(-120);
    expect(rowTotal(row({ action: "Buy", price: -10 }))).toBe(-10);
  });

  it("name actions in the ledger's vocabulary, older names included", () => {
    expect(formatTradeAction("Bought")).toBe("Buy");
    expect(formatTradeAction("trade sent")).toBe("Trade");
    expect(formatTradeAction("adjustment")).toBe("Adjustment");
    expect(formatTradeAction("Starting Gold")).toBe("Starting gold");
    expect(formatTradeAction(" Bounty ")).toBe("Bounty");
  });

  it("write amounts with their sign, and nothing as a dash", () => {
    expect(formatSignedAmount(8)).toBe("+8 gc");
    expect(formatSignedAmount(-120)).toBe("-120 gc");
    expect(formatSignedAmount(0)).toBe("-");
  });

  it("colour a badge red for spending and green for income", () => {
    expect(badgeClass(true)).toContain("red");
    expect(badgeClass(false)).toContain("emerald");
  });

  it("date a row, or leave the date out when it can't be read", () => {
    expect(formatRowDate("not a date")).toBe("");
    expect(formatRowDate("2026-10-01T10:00:00Z")).not.toBe("");
  });
});
