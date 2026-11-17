import { describe, expect, it } from "vitest";

import { blankFee } from "../../fees";
import { counterOf, lineWarning, paymentGold, paymentLines, paymentOf } from "./fee-payment";

const counters = [
  { id: 1, name: "Wyrdstone shards", amount: 1 },
  { id: 2, name: "Treasure", amount: 4 },
  // a counter someone happened to name after them: campaign points are still paid by nothing
  { id: 3, name: "Campaign points", amount: 9 },
];
const fee = {
  ...blankFee(),
  gold: 20,
  resources: [
    { resource: "Wyrdstone", amount: 2, names: ["wyrdstone", "wyrdstone shards"] },
    { resource: "Campaign points", amount: 5, names: ["campaign points"], campaign_points: true },
  ],
};

describe("a fee's payment", () => {
  it("starts as the fee asks, each line paid by the counter of its name", () => {
    const payment = paymentOf(fee);

    expect(paymentGold(payment)).toBe(20);
    expect(payment.lines.map((line) => counterOf(line, counters)?.id ?? null)).toEqual([1, null]);
    expect(paymentLines(payment, counters)).toEqual([
      { resource: "Wyrdstone", amount: 2, resource_id: 1 },
      { resource: "Campaign points", amount: 5, resource_id: null },
    ]);
  });

  it("warns of a short counter, never of one not paid or of campaign points", () => {
    const [wyrdstone, points] = paymentOf(fee).lines;

    expect(lineWarning(wyrdstone, counters)).toBe("Wyrdstone shards holds 1.");
    // nothing holds campaign points: the line says what the player takes off, and warns of nothing
    expect(lineWarning(points, counters)).toBe("");
    expect(lineWarning({ ...points, pick: "none" }, counters)).toBe("");
    expect(lineWarning({ ...wyrdstone, amount: "1" }, counters)).toBe("");
  });

  it("pays from the counter picked, or nothing", () => {
    const payment = paymentOf(fee);
    payment.lines[0].pick = 2;
    payment.lines[1].pick = "none";
    payment.gold = "15";

    expect(paymentGold(payment)).toBe(15);
    expect(paymentLines(payment, counters)).toEqual([
      { resource: "Wyrdstone", amount: 2, resource_id: 2 },
      { resource: "Campaign points", amount: 5, resource_id: null },
    ]);
  });
});
