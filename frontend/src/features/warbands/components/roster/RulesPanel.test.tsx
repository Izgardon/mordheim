import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

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

describe("A unit's boon or bane", () => {
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
