/** The strip of sides: a creature group's chip is its name, with no "neutral" (William, 26 Nov 2026). */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BattleSide } from "./battle-units";
import SideStrip from "./SideStrip";

const GRAVEYARD: BattleSide = {
  kind: "neutral",
  id: "neutral:n1",
  name: "Graveyard",
  group: { key: "n1", name: "Graveyard", creatures: [] },
  out: 1,
  total: 4,
};

describe("SideStrip", () => {
  it("names a creature group's chip by its name alone", () => {
    render(<SideStrip sides={[GRAVEYARD]} selectedId="neutral:n1" onSelect={vi.fn()} />);

    const chip = screen.getByRole("tab", { selected: true });
    expect(chip).toHaveTextContent(/^Graveyard1 of 4 out$/);
  });
});
