import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeTemplateUpgrade } from "@/test/template-fixtures";

import TemplateUpgrades from "./TemplateUpgrades";

describe("TemplateUpgrades", () => {
  it("says a group's note once over its upgrades, with each one's price", () => {
    const mutant = { note: "With the Mutant skill." };
    render(
      <TemplateUpgrades
        upgrades={[
          makeTemplateUpgrade(1, "Great Claw", 50, mutant),
          makeTemplateUpgrade(2, "Wings", 45, mutant),
          makeTemplateUpgrade(3, "Mark of Tchar", 0, { group: "Mark of the Dark Gods" }),
        ]}
      />
    );
    expect(screen.getAllByText("With the Mutant skill.")).toHaveLength(1);
    expect(screen.getByText("45 gc")).toBeInTheDocument();
    expect(screen.getByText("free")).toBeInTheDocument();
  });
});
