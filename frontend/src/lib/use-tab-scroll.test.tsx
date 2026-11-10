/**
 * A tab change keeps the tab bar at the top of the screen, never the page's top (William, 8 Nov
 * 2026: "when clicking through these tabs on mobile ... it scrolls the user to top of the screen,
 * it should only put the tab line to the top of the screen").
 */
import { useLayoutEffect, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTabScroll } from "./use-tab-scroll";

const AREA_TOP = 50; // under the app's top bar
const BAR_AT = 300; // the bar's place in the page
const SCREEN = 700;

let area: HTMLElement;

/** Where each box is on the screen at the area's scroll: the page column, the bar, its content. */
function placeBoxes({ sticky = false }: { sticky?: boolean } = {}) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    const scrolled = area?.scrollTop ?? 0;
    const at = (top: number, height = 40) => ({ top, bottom: top + height, height }) as DOMRect;
    if (this.hasAttribute("data-scroll-root")) return at(AREA_TOP, SCREEN);
    if (this.dataset.testid === "column") return at(AREA_TOP - scrolled, 0);
    if (this.dataset.testid === "header") {
      // a sticky header: in its place in the page, else stuck at the area's top
      return at(Math.max(AREA_TOP, AREA_TOP + BAR_AT - scrolled), 100);
    }
    if (this.dataset.testid === "content")
      return at(AREA_TOP + BAR_AT + (sticky ? 100 : 40) - scrolled);
    if (this.getAttribute("role") === "tablist") return at(AREA_TOP + BAR_AT - scrolled);
    return at(0);
  });
}

/** What a browser does when the new tab is shorter than the screen needs: it pulls the page up. */
function ShortTab() {
  useLayoutEffect(() => {
    area.scrollTop = 0;
  }, []);
  return <p>Backstory</p>;
}

function TabbedPage({ sticky = false }: { sticky?: boolean }) {
  const [tab, setTab] = useState("Roster");
  const tabs = useTabScroll();
  const bar = (
    <div ref={tabs.barRef} role="tablist">
      {["Roster", "Backstory"].map((name) => (
        <button
          key={name}
          type="button"
          role="tab"
          onClick={() => {
            tabs.pick();
            setTab(name);
          }}
        >
          {name}
        </button>
      ))}
    </div>
  );
  return (
    <div data-scroll-root="" data-testid="area">
      <div data-testid="column">
        {sticky ? (
          <div data-testid="header" style={{ position: "sticky" }}>
            {bar}
          </div>
        ) : (
          bar
        )}
        <div data-testid="content">{tab === "Roster" ? <p>Roster</p> : <ShortTab />}</div>
        <button type="button" onClick={() => (tabs.reveal(), setTab("Roster"))}>
          Next
        </button>
      </div>
    </div>
  );
}

function renderPage(options: { sticky?: boolean; scrolled: number }) {
  const view = render(<TabbedPage sticky={options.sticky} />);
  area = screen.getByTestId("area");
  Object.defineProperty(area, "clientHeight", { value: SCREEN, configurable: true });
  area.scrollTop = options.scrolled;
  return view;
}

describe("useTabScroll", () => {
  beforeEach(() => placeBoxes());
  afterEach(() => vi.restoreAllMocks());

  it("brings a tab bar from lower down to the top of the screen", () => {
    renderPage({ scrolled: 0 });

    fireEvent.click(screen.getByRole("tab", { name: "Backstory" }));

    expect(area.scrollTop).toBe(BAR_AT);
    // the page column is tall enough for the short tab to sit under the bar
    expect(screen.getByTestId("column").style.minHeight).toBe(`${BAR_AT + SCREEN}px`);
  });

  it("leaves a bar picked from at or above the top where it is, not at the page's top", () => {
    renderPage({ scrolled: BAR_AT + 20 }); // the bar's top 20 px above the screen's

    fireEvent.click(screen.getByRole("tab", { name: "Backstory" }));

    expect(area.scrollTop).toBe(BAR_AT + 20);
  });

  it("lands Next's step with the bar at the top, however far down it was pressed", () => {
    renderPage({ scrolled: 1500 });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(area.scrollTop).toBe(BAR_AT);
  });

  it("starts the step's content under a sticky header, which a tab pick leaves alone", () => {
    vi.restoreAllMocks();
    placeBoxes({ sticky: true });
    renderPage({ sticky: true, scrolled: 1500 });

    fireEvent.click(screen.getByRole("tab", { name: "Backstory" }));
    expect(area.scrollTop).toBe(1500);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(area.scrollTop).toBe(BAR_AT);
  });

  it("gives the page column its own height back when the page goes", () => {
    const view = renderPage({ scrolled: 0 });
    const column = screen.getByTestId("column");
    fireEvent.click(screen.getByRole("tab", { name: "Backstory" }));
    expect(column.style.minHeight).not.toBe("");

    view.unmount();

    expect(column.style.minHeight).toBe("");
  });
});
