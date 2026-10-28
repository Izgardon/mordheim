/**
 * Phone touch targets (the bestiary rewrite's browser check, found item 3): the companion switch
 * and the creature's paw, an item's menu dots, the companion chips and the Bestiary's Kind filter
 * each answer a 44 px tap on a touch or narrow screen and keep their look. A small control's box
 * grows around its visible part (`touch-target`), so rows of them never share a tap; the Kind
 * filter, whose look is its own box, takes taps above and below it (`touch-target-y`). jsdom has
 * no layout or media queries, so this checks the classes; `index-css.test.ts` checks their rules.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BestiaryKindFilter from "@/features/bestiary/components/BestiaryKindFilter";
import { renderWithQueryClient } from "@/test/query-test-utils";
import BeastItemButton from "./beasts/BeastItemButton";
import CompanionChips from "./beasts/CompanionChips";
import LoadoutEntryRow from "./LoadoutEntryRow";
import StashItemRow from "../warband/stash/StashItemRow";
import { heroKind } from "../../units/kinds/hero";

describe("touch targets on a phone", () => {
  it("gives the companion switch and the paw a 44 px box around their 20 px look", () => {
    render(
      <>
        <BeastItemButton kind="mount" on itemLabel="Warhorse" onClick={vi.fn()} />
        <BeastItemButton kind="creature" on={false} itemLabel="Wardogs" onClick={vi.fn()} />
      </>
    );

    for (const name of ["Warhorse: Switch off", "Wardogs: Recruit as henchmen"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveClass("touch-target");
      // The look (the bordered 20 px square) is the box's inner part, not the box.
      expect(button).not.toHaveClass("border");
      expect(button.firstElementChild).toHaveClass("h-5", "w-5", "border");
    }
  });

  it("gives a loadout item's switch and menu dots a 44 px box, the row centring them", () => {
    render(
      <LoadoutEntryRow
        entry={{
          id: "item-140-on",
          visibleId: 140,
          label: "Warhorse",
          type: "item",
          beast: { kind: "mount", on: true, rowId: 5 },
        }}
        memberCount={null}
        canEdit
        onClick={vi.fn()}
        onMenuClick={vi.fn()}
        onBeastClick={vi.fn()}
      />
    );

    const menu = screen.getByRole("button", { name: "Actions for Warhorse (ridden)" });
    expect(menu).toHaveClass("touch-target", "h-5", "w-4");
    expect(screen.getByRole("button", { name: "Warhorse: Switch off" })).toHaveClass(
      "touch-target"
    );
    expect(menu.parentElement).toHaveClass("touch-target-row");
  });

  it("gives a stash row's paw and menu dots a 44 px box", () => {
    render(
      <StashItemRow
        entry={{
          id: "stash-142",
          visibleId: 142,
          label: "Wardogs x 2",
          costs: "",
          beastKind: "creature",
        }}
        canEdit
        onMenuClick={vi.fn()}
        onRecruit={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Wardogs x 2: Recruit as henchmen" })).toHaveClass(
      "touch-target"
    );
    expect(screen.getByRole("button", { name: "Actions for Wardogs x 2" })).toHaveClass(
      "touch-target"
    );
  });

  it("gives each companion chip a 44 px box around its 22 px pill", () => {
    renderWithQueryClient(
      <CompanionChips
        kind={heroKind}
        unit={{
          id: 11,
          name: "Aldric",
          mount: {
            item_row_id: 1,
            item_id: 140,
            name: "Warhorse",
            movement: 8,
            rating_bonus: 5,
            has_profile: false,
            stats: null,
          },
          pets: [{ item_row_id: 2, item_id: 141, name: "Raven", has_profile: false, stats: null }],
        }}
        warbandId={9}
        canManageItems={false}
      />
    );

    for (const name of ["Mount: Warhorse", "Pet: Raven"]) {
      const chip = screen.getByRole("button", { name });
      expect(chip).toHaveClass("touch-target");
      expect(chip.firstElementChild).toHaveClass("rounded-full", "border", "py-0.5");
    }
  });

  it("lets each Bestiary Kind button take taps above and below its 28 px look", () => {
    render(<BestiaryKindFilter value={null} onChange={vi.fn()} />);

    for (const name of ["All", "Mount", "Pet", "Creature"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("touch-target-y", "py-1.5");
    }
    // Nothing clips the taps above and below the buttons.
    expect(screen.getByRole("group", { name: "Kind" })).not.toHaveClass("overflow-hidden");
  });
});
