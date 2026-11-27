/**
 * The workshop's nav (William, 26 Nov 2026: its scrollbar touched the pills): on a phone one row
 * scrolling sideways with the gap every such row keeps above its scrollbar; on the web it wraps.
 * Every pill leads with its icon (William, 27 Nov 2026), My content's the Reference nav's own.
 */
import { render, screen, within } from "@testing-library/react";
import type { IconType } from "react-icons";
import { GiBrutalHelm, GiCheckedShield } from "react-icons/gi";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { REFERENCE_LINKS } from "@/layouts/shell/campaign-nav";

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

  it("leads every pill with its icon, My content's as the Reference nav shows them", () => {
    const nav = renderNav();
    const reference = (path: string) =>
      REFERENCE_LINKS.find((link) => link.path === path)?.icon as IconType;
    const pills: [string, IconType][] = [
      ["Warbands", GiBrutalHelm],
      // a list keeps the shield the Reference nav gives Warband lists (William, 27 Nov 2026)
      ["Lists", GiCheckedShield],
      ["Items", reference("items")],
      ["Skills", reference("skills")],
      ["Spells", reference("spells")],
      ["Specials", reference("boons-banes")],
      ["Beasts", reference("bestiary")],
      ["Hired swords", reference("hired-swords")],
      ["Dramatis personae", reference("dramatis-personae")],
    ];
    const drawn = (Icon: IconType) => {
      const { container, unmount } = render(<Icon />);
      const paths = container.querySelector("svg")?.innerHTML;
      unmount();
      return paths;
    };

    expect(within(nav).getAllByRole("link")).toHaveLength(pills.length);
    for (const [label, Icon] of pills) {
      const icon = within(nav).getByRole("link", { name: label }).querySelector("svg");
      expect(icon, label).toHaveAttribute("aria-hidden", "true");
      expect(icon?.innerHTML, label).toBe(drawn(Icon));
    }
  });
});
