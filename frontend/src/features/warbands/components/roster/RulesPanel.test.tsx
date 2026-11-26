import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { makeHero, makeItem } from "@/test/warband-fixtures";

import RulesPanel, { type BoxDetail } from "./RulesPanel";

const renderPanel = (detail: BoxDetail) =>
  render(
    <MemoryRouter initialEntries={["/campaigns/4/warband"]}>
      <Routes>
        <Route
          path="/campaigns/:id/warband"
          element={<RulesPanel detail={detail} onClose={vi.fn()} />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("A unit's special", () => {
  it("links its psychology rule's part of the Rules page", () => {
    renderPanel({
      name: "Stupidity",
      kind: "Psychology",
      text: "The model is subject to stupidity.",
      special: true,
    });

    expect(screen.getByRole("link", { name: "Stupidity in the rules" })).toHaveAttribute(
      "href",
      "/campaigns/4/rules?open=leadership-psychology-stupidity"
    );
  });

  it("links nothing for any other rule, nor a skill of a psychology name", () => {
    const { unmount } = renderPanel({ name: "Large", kind: "Trait", special: true });
    expect(screen.queryByRole("link")).toBeNull();
    unmount();

    renderPanel({ name: "Fearsome", kind: "Skill" });
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("An opened box's panel", () => {
  it("takes its kind's colour on its border, as its box does (William, 25 Nov 2026)", () => {
    const { container } = renderPanel({
      name: "Strike to Injure",
      kind: "Combat",
      boxKind: "skill",
    });
    expect(container.querySelector('[data-trim="skill"]')).toHaveClass("border-kind-skill");
  });
});

describe("An opened item's actions", () => {
  // William, 25 Nov 2026: one row above the rules, the item's own action first
  it("put a creature's Make henchmen first, before Move to, Stash, Sell and Buy again", () => {
    render(
      <RulesPanel
        detail={{
          name: "Wardog",
          kind: "Creature",
          text: "A hound of war.",
          item: makeItem({ id: 202, name: "Wardog", beast_kind: "creature" }),
          boxKind: "beast",
        }}
        onClose={vi.fn()}
        itemActions={{
          owner: { kind: "hero", unit: makeHero({ id: 5 }) },
          targets: [],
          onMove: vi.fn(),
          onSell: vi.fn(),
          onBuyAgain: vi.fn(),
          onMakeHenchmen: vi.fn(),
        }}
      />
    );

    const row = screen.getByTestId("item-actions");
    expect(row.firstElementChild).toHaveTextContent("Make henchmen");
    expect(row.querySelectorAll("button")).toHaveLength(5);
    const text = screen.getByText("A hound of war.");
    expect(row.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
