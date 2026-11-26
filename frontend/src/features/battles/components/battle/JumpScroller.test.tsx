/**
 * The phone battle screen's Jump button (William, 26 Nov 2026): it steps down through the shown
 * side's section headings, points up on the last and goes back to the first, follows a manual
 * scroll, and stays away with fewer than two sections. jsdom has no layout, so each heading's
 * place in the list and the list's height are given here.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import JumpScroller from "./JumpScroller";

// a heading's distance from the top of the list's content; the list is 600 high, 2400 long
const OFFSETS: Record<string, number> = { Heroes: 150, Henchmen: 910, "Hired swords": 1510 };
let scrollTop = 0;
let moves = true;
const scrollTo = vi.fn();

beforeEach(() => {
  scrollTop = 0;
  moves = true;
  scrollTo.mockReset();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    const top = this.dataset.jumpSection ? (OFFSETS[this.textContent ?? ""] ?? 0) - scrollTop : 0;
    return { top } as DOMRect;
  });
  Object.defineProperties(HTMLElement.prototype, {
    scrollHeight: { configurable: true, get: () => 2400 },
    clientHeight: { configurable: true, get: () => 600 },
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    },
    scrollTo: {
      configurable: true,
      writable: true,
      value(this: HTMLElement, options: ScrollToOptions) {
        scrollTo(options);
        if (!moves) return;
        scrollTop = options.top ?? 0;
        this.dispatchEvent(new Event("scrollend"));
      },
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const name of ["scrollHeight", "clientHeight", "scrollTop", "scrollTo"]) {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
  }
});

const sections = (...labels: string[]) => (
  <JumpScroller>
    <p>The feed</p>
    {labels.map((label) => (
      <h2 key={label} data-jump-section={label}>
        {label}
      </h2>
    ))}
  </JumpScroller>
);

const jump = () => screen.getByRole("button", { name: /^Jump to / });
const points = () => (jump().querySelector(".lucide-arrow-up") ? "up" : "down");

describe("JumpScroller", () => {
  it("steps down through the sections, then points up and goes back to the first", () => {
    render(sections("Heroes", "Henchmen", "Hired swords"));

    expect(jump()).toHaveAccessibleName("Jump to Heroes");
    expect(jump()).toHaveTextContent("Jump");
    expect(points()).toBe("down");

    fireEvent.click(jump());
    // the heading lands where the list starts, under the bars
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 140 }));
    expect(jump()).toHaveAccessibleName("Jump to Henchmen");

    fireEvent.click(jump());
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 900 }));
    expect(jump()).toHaveAccessibleName("Jump to Hired swords");
    expect(points()).toBe("down");

    fireEvent.click(jump());
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 1500 }));
    expect(jump()).toHaveAccessibleName("Jump to Heroes");
    expect(points()).toBe("up");

    fireEvent.click(jump());
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 140 }));
    expect(jump()).toHaveAccessibleName("Jump to Henchmen");
    expect(points()).toBe("down");
  });

  it("goes on from wherever the player scrolled to", () => {
    const { container } = render(sections("Heroes", "Henchmen", "Hired swords"));
    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;

    act(() => {
      scrollTop = 1000;
      scroller.dispatchEvent(new Event("scrollend"));
    });

    expect(jump()).toHaveAccessibleName("Jump to Hired swords");
  });

  it("goes on to the section after the one a jump is still scrolling to", () => {
    moves = false;
    render(sections("Heroes", "Henchmen", "Hired swords"));

    fireEvent.click(jump());
    fireEvent.click(jump());

    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 900 }));
  });

  it("stays away with one section or none", () => {
    const { rerender } = render(sections("Heroes"));
    expect(screen.queryByRole("button", { name: /Jump/ })).not.toBeInTheDocument();

    rerender(sections());
    expect(screen.queryByRole("button", { name: /Jump/ })).not.toBeInTheDocument();

    rerender(sections("Heroes", "Henchmen"));
    expect(jump()).toHaveAccessibleName("Jump to Heroes");
  });
});
