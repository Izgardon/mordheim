import { describe, expect, it } from "vitest";

import {
  getActiveMobileNavigationValue,
  getWarbandMobileTopBarTitle,
  type MobileEditNavigationItem,
} from "../useWarbandMobileTopBar";

const navigationItems: MobileEditNavigationItem[] = [
  {
    value: "hero-1",
    label: "Captain",
    elementId: "hero-1",
  },
  {
    value: "hero-2",
    label: "Youngblood",
    elementId: "hero-2",
  },
  {
    value: "add-new",
    label: "Add New",
    elementId: "add-new",
  },
];

describe("getActiveMobileNavigationValue", () => {
  it("switches to a navigation item once it is close to the mobile top bar", () => {
    const topsById = new Map([
      ["hero-1", -12],
      ["hero-2", 36],
      ["add-new", 420],
    ]);

    const result = getActiveMobileNavigationValue(
      navigationItems,
      (item) => topsById.get(item.elementId) ?? null
    );

    expect(result).toBe("hero-2");
  });

  it("falls back to the nearest upcoming item when none are near the threshold yet", () => {
    const topsById = new Map([
      ["hero-1", 140],
      ["hero-2", 260],
      ["add-new", 420],
    ]);

    const result = getActiveMobileNavigationValue(
      navigationItems,
      (item) => topsById.get(item.elementId) ?? null
    );

    expect(result).toBe("hero-1");
  });
});

describe("getWarbandMobileTopBarTitle", () => {
  it("returns a loading title while the warband name is still being resolved", () => {
    expect(
      getWarbandMobileTopBarTitle({
        warbandName: undefined,
        isLoadingWarband: true,
      })
    ).toBe("Loading...");
  });

  it("returns the warband name once loading is complete", () => {
    expect(
      getWarbandMobileTopBarTitle({
        warbandName: "The Black Crows",
        isLoadingWarband: false,
      })
    ).toBe("The Black Crows");
  });

  it("falls back to the section title when the rejoin button is shown", () => {
    expect(
      getWarbandMobileTopBarTitle({
        warbandName: "The Black Crows",
        isLoadingWarband: false,
        hasRejoinButton: true,
      })
    ).toBe("Warband");
  });
});
