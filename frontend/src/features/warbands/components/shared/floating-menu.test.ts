import { describe, expect, it } from "vitest";

import { FLOATING_MENU_WIDTH, getFloatingMenuPosition } from "./floating-menu";

const viewport = { width: 1000, height: 800 };
const anchor = (top: number, right: number) => ({ top, bottom: top + 20, right });

describe("getFloatingMenuPosition", () => {
  it("opens below the button, right-aligned with it", () => {
    expect(getFloatingMenuPosition(anchor(100, 500), 3, viewport)).toEqual({
      top: 124,
      left: 500 - FLOATING_MENU_WIDTH,
      menuWidth: FLOATING_MENU_WIDTH,
    });
  });

  it("opens above the button when there is more room there", () => {
    // Three rows are 93 px; 20 px are left below a button at 760.
    expect(getFloatingMenuPosition(anchor(760, 500), 3, viewport).top).toBe(760 - 93 - 4);
  });

  it("stays inside the viewport at the edges", () => {
    expect(getFloatingMenuPosition(anchor(100, 50), 3, viewport).left).toBe(12);
    expect(getFloatingMenuPosition(anchor(100, 2000), 3, viewport).left).toBe(
      1000 - 12 - FLOATING_MENU_WIDTH
    );
    expect(getFloatingMenuPosition(anchor(0, 500), 30, viewport).top).toBe(12);
  });
});
