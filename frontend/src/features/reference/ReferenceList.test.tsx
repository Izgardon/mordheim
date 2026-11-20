/**
 * A reference row's right side on a phone (its `aside`: a price and rarity, a hire fee and an
 * upkeep). William, 20 Nov 2026, of the Dramatis personae list: "can hire and upkeep lines be
 * allowed to span multiple rows like the title is doing on mobile so the title area has at least
 * 50 percent of width". A unit test can't measure widths, so this asserts the shape that caused
 * it: the aside is capped at half the row and its lines wrap, instead of holding their width.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReferenceList, ReferenceRow } from "./ReferenceList";

const renderRow = () =>
  render(
    <ReferenceList isEmpty={false}>
      <ReferenceRow
        id="7"
        open={false}
        onToggle={() => undefined}
        name="Ar-Ulric Emil Valgeir"
        aside={
          <>
            <span>90 gc + 5 Campaign points</span>
            <span>upkeep 30 gc + 1 Campaign points</span>
          </>
        }
      />
    </ReferenceList>
  );

describe("a reference row's aside", () => {
  it("takes half the row at most and wraps, the name keeping the rest", () => {
    renderRow();

    const aside = screen.getByText("90 gc + 5 Campaign points").parentElement;
    expect(aside?.className).toContain("max-w-[50%]");
    expect(aside?.className).not.toContain("shrink-0");
    expect(aside?.className).not.toContain("whitespace-nowrap");
  });
});
