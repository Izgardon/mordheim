import { describe, expect, it } from "vitest";

import {
  actionBadgeClass,
  formatRowDate,
  formatSignedAmount,
  rowAmount,
  rowTotal,
} from "./treasury-format";

import type { WarbandTrade } from "../../../types/warband-types";

const row = (overrides: Partial<WarbandTrade>): WarbandTrade => ({
  id: 1,
  warband_id: 9,
  parent_id: null,
  action: "Sold",
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
  it("sign spending negative and income positive, by the row's action", () => {
    expect(rowAmount({ action: "Bought", price: 5 })).toBe(-5);
    expect(rowAmount({ action: "Recruited", price: -60 })).toBe(-60);
    expect(rowAmount({ action: "Sold", price: 5 })).toBe(5);
    expect(rowAmount({ action: "Starting gold", price: 500 })).toBe(500);
  });

  it("total a group by its children, not by its own action (BUG-38)", () => {
    const recruits = row({
      action: "Group",
      price: 0,
      children: [child(2, "Recruited", -60), child(3, "Recruited", -60)],
    });
    expect(rowTotal(recruits)).toBe(-120);
    expect(rowTotal(row({ action: "Bought", price: 10 }))).toBe(-10);
  });

  it("write amounts with their sign, and nothing as a dash", () => {
    expect(formatSignedAmount(8)).toBe("+8 gc");
    expect(formatSignedAmount(-120)).toBe("-120 gc");
    expect(formatSignedAmount(0)).toBe("-");
  });

  it("colour an action's badge by its sign", () => {
    expect(actionBadgeClass("Upkeep")).toContain("red");
    expect(actionBadgeClass("Reward")).toContain("emerald");
  });

  it("date a row, or leave the date out when it can't be read", () => {
    expect(formatRowDate("not a date")).toBe("");
    expect(formatRowDate("2026-10-01T10:00:00Z")).not.toBe("");
  });
});
