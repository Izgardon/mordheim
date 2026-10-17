import { describe, expect, it } from "vitest";

import { acquireBlockers, NO_WARBAND_NOTICE } from "./acquire-blockers";

const ready = {
  hasWarband: true,
  gold: 100,
  reservedGold: 0,
  isBuying: true,
  totalPrice: 20,
  canProceed: true,
  isSubmitting: false,
  unitType: "stash" as const,
  unitId: "",
};

describe("acquireBlockers", () => {
  it("lets a purchase the warband can afford go ahead", () => {
    expect(acquireBlockers(ready)).toEqual({
      notice: "",
      actionDisabled: false,
      actionDisabledReason: "",
    });
  });

  it("refuses a purchase over the gold left after queued purchases, naming what is left", () => {
    const blocked = acquireBlockers({ ...ready, gold: 30, reservedGold: 15 });
    expect(blocked.notice).toBe("Not enough gold crowns. Available: 15 gc.");
    expect(blocked.actionDisabled).toBe(true);
    expect(blocked.actionDisabledReason).toBe(blocked.notice);
  });

  it("checks no gold for a gift or a free item, and says when gold is unknown", () => {
    expect(acquireBlockers({ ...ready, gold: 0, isBuying: false }).notice).toBe("");
    expect(acquireBlockers({ ...ready, gold: 0, totalPrice: 0 }).notice).toBe("");
    expect(acquireBlockers({ ...ready, gold: null }).notice).toBe(
      "Gold crowns unknown for this warband."
    );
  });

  it("says a warband is needed before anything else", () => {
    const blocked = acquireBlockers({ ...ready, hasWarband: false, canProceed: false });
    expect(blocked.notice).toBe(NO_WARBAND_NOTICE);
    expect(blocked.actionDisabledReason).toBe(NO_WARBAND_NOTICE);
  });

  it("asks for a receiver of the chosen kind", () => {
    const pick = (unitType: "heroes" | "hiredswords" | "henchmen" | "") =>
      acquireBlockers({ ...ready, canProceed: false, unitType }).actionDisabledReason;
    expect(pick("")).toBe("Select who receives the item.");
    expect(pick("heroes")).toBe("Select a hero to receive the item.");
    expect(pick("hiredswords")).toBe("Select a hired sword to receive the item.");
    expect(pick("henchmen")).toBe("Select a henchmen group to receive the item.");
  });

  it("says a purchase or gift is under way while it is sent", () => {
    expect(acquireBlockers({ ...ready, isSubmitting: true }).actionDisabledReason).toBe(
      "Processing purchase..."
    );
    expect(
      acquireBlockers({ ...ready, isSubmitting: true, isBuying: false }).actionDisabledReason
    ).toBe("Processing...");
  });
});
