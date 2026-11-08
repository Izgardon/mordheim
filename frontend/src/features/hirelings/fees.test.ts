import { describe, expect, it } from "vitest";

import { feeDraftOf, feeFromDraft } from "./components/fees/fee-draft";
import { blankFee, feeGold, feeReads, formatFee, matchCounter, type Fee } from "./fees";

const fee = (change: Partial<Fee>): Fee => ({ ...blankFee(), ...change });

describe("structured fees", () => {
  it("reads a fee in words", () => {
    expect(formatFee(fee({ gold: 70, dice: 3 }))).toBe("70 gc + 3D6");
    expect(
      formatFee(fee({ gold: 90, resources: [{ resource: "Campaign points", amount: 5 }] }))
    ).toBe("90 gc + 5 Campaign points");
    expect(formatFee(fee({ resources: [{ resource: "Wyrdstone", amount: 1 }] }))).toBe(
      "1 Wyrdstone"
    );
    expect(formatFee(fee({ kind: "replaces_hero" }))).toBe("Takes a hero's place");
    expect(formatFee(fee({ kind: "none" }))).toBe("None");
    expect(formatFee(undefined)).toBe("-");
  });

  it("reads a fee as the form's line under it does (William, 7 Nov 2026)", () => {
    const wyrdstone = [{ resource: "Wyrdstone", amount: 1 }];
    expect(feeReads(fee({ gold: 30, dice: 1, resources: wyrdstone }))).toBe(
      "30 + D6 gc and 1 Wyrdstone"
    );
    expect(feeReads(fee({ dice: 2, dice_multiplier: 5 }))).toBe("2D6×5 gc");
    expect(feeReads(fee({ resources: wyrdstone }))).toBe("1 Wyrdstone");
    expect(feeReads(fee({ kind: "special" }))).toBe("See his rules");
    expect(feeReads(fee({}))).toBe("-");
  });

  it("asks its gold, plus the roll times the multiplier, and nothing when it isn't gold", () => {
    expect(feeGold(fee({ gold: 70, dice: 3 }))).toBe(70);
    expect(feeGold(fee({ gold: 70, dice: 3 }), 11)).toBe(81);
    expect(feeGold(fee({ gold: 200, dice: 1, dice_multiplier: 25 }), 4)).toBe(300);
    expect(feeGold(fee({ kind: "special", gold: 50 }))).toBe(0);
  });

  it("finds the counter that pays a resource by the server's names, else by its own", () => {
    const counters = [
      { id: 1, name: "Wyrdstone Shards" },
      { id: 2, name: "Gromril" },
    ];
    const names = ["wyrdstone", "wyrdstone shards", "shards"];
    expect(matchCounter({ resource: "Wyrdstone", names }, counters)?.id).toBe(1);
    expect(matchCounter({ resource: "gromril" }, counters)?.id).toBe(2);
    expect(matchCounter({ resource: "Treasure", names: ["treasure"] }, counters)).toBeNull();
  });

  it("pays a line the server marks default_resource from the default resource, whatever its name", () => {
    const counters = [
      { id: 1, name: "Wyrdstone Shards", is_default: false },
      { id: 2, name: "Warpstone", is_default: true },
    ];
    const names = ["wyrdstone", "wyrdstone shards", "shards"];
    expect(
      matchCounter({ resource: "Wyrdstone", names, default_resource: true }, counters)?.id
    ).toBe(2);
    expect(matchCounter({ resource: "Wyrdstone", names }, counters)?.id).toBe(1);
  });

  it("keeps a form's fee as the server stores it", () => {
    const draft = {
      ...feeDraftOf(null),
      gold: "70",
      dice: "3",
      resources: [
        { resource: " Wyrdstone ", amount: "1" },
        { resource: "", amount: "2" },
      ],
    };
    expect(feeFromDraft(draft)).toEqual(
      fee({ gold: 70, dice: 3, resources: [{ resource: "Wyrdstone", amount: 1 }] })
    );
    expect(feeFromDraft({ ...draft, kind: "replaces_hero", note: " Free " })).toEqual(
      fee({ kind: "replaces_hero", note: "Free" })
    );
    expect(feeDraftOf(fee({ gold: 15, note: "15 gc*" }))).toMatchObject({ gold: "15", dice: "" });
  });
});
