/** Who a scenario is for, seen at a glance (William, 25 Nov 2026), and the filters that take "either" in. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ScenarioPlayersIcon, { playersMatch } from "./ScenarioPlayersIcon";

describe("ScenarioPlayersIcon", () => {
  it("shows both icons for a scenario for either", () => {
    render(<ScenarioPlayersIcon players="either" />);
    const icon = screen.getByRole("img", { name: "1v1 or multiplayer" });
    expect(icon.querySelectorAll("svg")).toHaveLength(2);
  });

  it("shows one icon for 1v1 and one for multiplayer", () => {
    render(<ScenarioPlayersIcon players="1v1" />);
    expect(screen.getByRole("img", { name: "1v1" }).querySelectorAll("svg")).toHaveLength(1);
  });

  it("lets the 1v1 and Multiplayer filters both take in a scenario for either", () => {
    expect(playersMatch("either", "1v1")).toBe(true);
    expect(playersMatch("either", "multiplayer")).toBe(true);
    expect(playersMatch("1v1", "multiplayer")).toBe(false);
    expect(playersMatch("multiplayer", "all")).toBe(true);
  });
});
