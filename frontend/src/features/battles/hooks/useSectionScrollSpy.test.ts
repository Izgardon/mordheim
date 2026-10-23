/**
 * The phone's postbattle section picker follows the section scrolled to, but a section picked from
 * it stays picked while its jump scrolls the page, even the last, short one that can never reach
 * the top (the step 2 browser check's found item 10: Leaving read "Upkeep"); the player's own
 * scrolling (a touch, the wheel, a key) hands it back to the scroll.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPostbattleSectionId } from "@/features/battles/components/postbattle/PostbattleSection";

import { useSectionScrollSpy } from "./useSectionScrollSpy";

/** Where each section's top sits on screen: Upkeep has passed the bars, Leaving can't reach them. */
const TOPS: Record<string, number> = {
  exploration: -900,
  roster: -600,
  finds: -300,
  upkeep: 40,
  leaving: 400,
};

let sections: HTMLElement[] = [];
let frames: FrameRequestCallback[] = [];

/** Runs the frames the scroll events asked for. */
const nextFrame = () =>
  act(() => {
    const due = frames;
    frames = [];
    due.forEach((callback) => callback(0));
  });

beforeEach(() => {
  sections = Object.entries(TOPS).map(([key, top]) => {
    const element = document.createElement("section");
    element.id = getPostbattleSectionId(key as never);
    element.getBoundingClientRect = () => ({ top }) as DOMRect;
    document.body.appendChild(element);
    return element;
  });
  // Frames run when a test says so (`nextFrame`), as the browser runs them after the event.
  frames = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
});

afterEach(() => {
  sections.forEach((element) => element.remove());
  vi.restoreAllMocks();
});

const scroll = () => {
  act(() => window.dispatchEvent(new Event("scroll")));
  nextFrame();
};

describe("the postbattle section picker", () => {
  it("keeps Leaving picked while its jump scrolls, though it never reaches the top, until the player scrolls", () => {
    const { result } = renderHook(() =>
      useSectionScrollSpy({ isMobile: true, hasUpkeep: true, hasLeaving: true })
    );
    nextFrame();
    expect(result.current.selectedSection).toBe("upkeep");

    act(() => result.current.changeSection("leaving"));
    scroll();
    scroll();

    expect(result.current.selectedSection).toBe("leaving");

    act(() => window.dispatchEvent(new Event("touchstart")));
    scroll();

    expect(result.current.selectedSection).toBe("upkeep");
  });

  it("follows the scroll as before when nothing was picked", () => {
    const { result } = renderHook(() =>
      useSectionScrollSpy({ isMobile: true, hasUpkeep: true, hasLeaving: true })
    );

    scroll();

    expect(result.current.selectedSection).toBe("upkeep");
  });
});
