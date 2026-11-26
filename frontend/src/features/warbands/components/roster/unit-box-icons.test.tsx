/** The unit card's icons (William, 25 Nov 2026): a spell's book, and a boon keeping its own gold. */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SPECIAL_KIND_COLOURS } from "@/components/ui/game-icons";
import { makeHero } from "@/test/warband-fixtures";

import { entryBoxes } from "./unit-boxes";
import type { RosterUnit } from "./unit-view";

const hero = { kind: "hero", unit: makeHero({ id: 1, name: "Mortis" }) } as RosterUnit;

describe("the unit card's box icons", () => {
  it("gives a spell its book", () => {
    const [box] = entryBoxes(hero, "spells", [{ name: "Lifestealer", type: "Necromancy" }]);
    const { container } = render(<>{box.icon}</>);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("keeps a boon's icon its own gold, not the specials stripe colour", () => {
    expect(SPECIAL_KIND_COLOURS.boon).toBe("text-boon");
  });
});
