/**
 * The phone's tab row (the loadout tabs): the active tab scrolls into view when the row opens on
 * it and when it changes, so a tab past the screen's edge (Hired Swords, Dramatis Personae) isn't
 * hidden (the step 2 browser check's found item 9). One already in view leaves the row where it is.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MobileTabs from "./mobile-tabs";

const TABS = [
  { id: "items", label: "Items" },
  { id: "skills", label: "Skills" },
  { id: "bestiary", label: "Bestiary" },
  { id: "dramatis-personae", label: "Dramatis Personae" },
] as const;

/** Lays the row out as a 300px window onto chips 100px wide, side by side. */
function layOut() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    const index = TABS.findIndex((tab) => this.textContent === tab.label);
    const scrolled = (this.closest(".overflow-x-auto") as HTMLElement | null)?.scrollLeft ?? 0;
    const left = index >= 0 ? index * 100 - scrolled : 0;
    const width = index >= 0 ? 100 : 300;
    return { left, right: left + width, width, top: 0, bottom: 30, height: 30 } as DOMRect;
  });
}

const row = () => screen.getByRole("button", { name: "Items" }).closest(".overflow-x-auto")!;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MobileTabs", () => {
  it("scrolls the active tab into view when the row opens on one past its edge", () => {
    layOut();

    render(<MobileTabs tabs={TABS} activeTab="dramatis-personae" onTabChange={() => undefined} />);

    // Chip 4 spans 300 to 400: centred in the 300px window, the row scrolls by 200.
    expect(row().scrollLeft).toBe(200);
  });

  it("scrolls again when the active tab changes, and leaves a tab already in view alone", () => {
    layOut();
    const { rerender } = render(
      <MobileTabs tabs={TABS} activeTab="skills" onTabChange={() => undefined} />
    );
    expect(row().scrollLeft).toBe(0);

    rerender(
      <MobileTabs tabs={TABS} activeTab="dramatis-personae" onTabChange={() => undefined} />
    );

    expect(row().scrollLeft).toBe(200);
  });
});
