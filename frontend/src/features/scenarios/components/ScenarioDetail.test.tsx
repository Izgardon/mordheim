import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeScenario } from "@/test/scenario-fixtures";

import ScenarioDetail from "./ScenarioDetail";

describe("ScenarioDetail", () => {
  it("reads as the opening lines, then each section under its heading with its tables in place", () => {
    render(<ScenarioDetail scenario={makeScenario()} />);

    expect(screen.getByText(/Scattered in the ruins/)).toBeInTheDocument();
    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
      "Terrain",
      "Special rules",
    ]);
    const rules = screen.getByRole("region", { name: "Special rules" });
    expect(within(rules).getByText("Place D3+1 counters.")).toBeInTheDocument();
    expect(within(rules).getByRole("columnheader", { name: "Found" })).toBeInTheDocument();
    expect(rules).not.toHaveTextContent("{{table:1}}");
  });

  it("shows a heading over its sub-headings alone with no text", () => {
    render(
      <ScenarioDetail
        scenario={{ intro: "", sections: [{ title: "Special rules", text: "", tables: [] }] }}
      />
    );
    expect(screen.getByRole("heading", { name: "Special rules" })).toBeInTheDocument();
  });
});
