/**
 * The warband page's tabs on a phone (William, 8 Nov 2026: "when clicking through these tabs on
 * mobile ... it scrolls the user to top of the screen, it should only put the tab line to the top
 * of the screen"): a tab change keeps the page off its top, and a new page still starts there.
 */
import { useLayoutEffect } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ScrollToTop from "@/components/ScrollToTop";

import WarbandTabs from "./WarbandTabs";

const BAR_AT = 500;

function scrollArea() {
  return screen.getByTestId("shell-scroll");
}

/** The browser pulling the page up to fit a tab shorter than the screen. */
function ShortTab() {
  useLayoutEffect(() => {
    scrollArea().scrollTop = 0;
  }, []);
  return <p>No backstory yet.</p>;
}

function Shell() {
  return (
    <>
      <ScrollToTop />
      <div data-scroll-root="" data-testid="shell-scroll">
        <Outlet />
      </div>
    </>
  );
}

describe("WarbandTabs", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    // the bar 500 px down the page, the scroll area from the screen's top
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      const scrolled = document.querySelector("[data-scroll-root]")?.scrollTop ?? 0;
      const top = this.getAttribute("role") === "tablist" ? BAR_AT - scrolled : 0;
      return { top, bottom: top + 40, height: 40 } as DOMRect;
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps the tab bar at the top of the screen on a tab change, and a new page at its top", async () => {
    const router = createMemoryRouter(
      [
        {
          element: <Shell />,
          children: [
            {
              path: "/campaigns/7/warband",
              element: (
                <WarbandTabs
                  render={(tab) => (tab === "Backstory" ? <ShortTab /> : <p>{tab}</p>)}
                />
              ),
            },
            { path: "/campaigns/7/skills", element: <p>Skills</p> },
          ],
        },
      ],
      { initialEntries: ["/campaigns/7/warband"] }
    );
    render(<RouterProvider router={router} />);
    const area = scrollArea();
    Object.defineProperty(area, "clientHeight", { value: 700, configurable: true });
    area.scrollTop = BAR_AT - 120; // the bar 120 px below the screen's top

    fireEvent.click(screen.getByRole("tab", { name: "Backstory" }));

    expect(screen.getByText("No backstory yet.")).toBeInTheDocument();
    expect(area.scrollTop).toBe(BAR_AT);

    await act(() => router.navigate("/campaigns/7/skills"));

    expect(area.scrollTop).toBe(0);
  });
});
