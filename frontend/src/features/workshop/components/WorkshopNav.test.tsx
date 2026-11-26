/**
 * The workshop's nav (William, 26 Nov 2026: its scrollbar touched the pills): on a phone one row
 * scrolling sideways with the gap every such row keeps above its scrollbar; on the web it wraps.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkshopNav from "./WorkshopNav";

const media = vi.hoisted(() => ({ mobile: false }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => media.mobile }));

function renderNav() {
  render(
    <MemoryRouter initialEntries={["/workshop/13/skills"]}>
      <WorkshopNav workshopId={13} />
    </MemoryRouter>
  );
  return screen.getByRole("navigation", { name: "Workshop" });
}

describe("the workshop's nav", () => {
  beforeEach(() => {
    media.mobile = false;
  });

  it("scrolls sideways on a phone with room between the pills and the scrollbar", () => {
    media.mobile = true;
    const nav = renderNav();

    expect(nav).toHaveClass("scroll-row");
    expect(nav).not.toHaveClass("flex-wrap");
    expect(screen.getByRole("link", { name: "Skills" })).toHaveAttribute("aria-current", "page");
  });

  it("wraps on the web, with no sideways scroll", () => {
    const nav = renderNav();

    expect(nav).toHaveClass("flex-wrap");
    expect(nav).not.toHaveClass("scroll-row");
  });
});
