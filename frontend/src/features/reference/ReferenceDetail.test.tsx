/**
 * An open reference row: two columns on the web, one on a phone. William, 23 Nov 2026: on his
 * phone some warband templates on Reference → Warbands opened wider than the screen, cut off at
 * its edge, because the phone's column was sized to its content (one long line of rule pills)
 * rather than to the row.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReferenceDetail } from "./ReferenceDetail";

function renderDetail(isMobile: boolean) {
  const { container } = render(
    <ReferenceDetail title="Dwarf Slayer Cult" isMobile={isMobile} aside={<p>Slayer list</p>}>
      <p>Deathwish</p>
    </ReferenceDetail>
  );
  return {
    root: container.firstElementChild as HTMLElement,
    main: screen.getByText("Deathwish").parentElement as HTMLElement,
    aside: screen.getByText("Slayer list").parentElement as HTMLElement,
  };
}

describe("ReferenceDetail", () => {
  it("makes both parts exactly the row's width on a phone, whatever they hold", () => {
    const { root, main, aside } = renderDetail(true);

    expect(root).toHaveClass("flex-col", "break-words");
    // a wrapping or start-aligned column flexbox sizes its parts to their content
    expect(root).not.toHaveClass("flex-wrap");
    expect(root).not.toHaveClass("items-start");
    expect(main).toHaveClass("w-full", "min-w-0");
    expect(aside).toHaveClass("w-full", "min-w-0");
  });

  it("keeps the web's two columns beside each other", () => {
    const { root, main, aside } = renderDetail(false);

    expect(root).toHaveClass("flex-wrap", "items-start", "break-words");
    expect(screen.getByRole("heading", { name: "Dwarf Slayer Cult" })).toBeInTheDocument();
    expect(main).toHaveClass("flex-[999_1_520px]");
    expect(main).not.toHaveClass("w-full");
    expect(aside).toHaveClass("flex-[1_1_300px]");
  });
});
