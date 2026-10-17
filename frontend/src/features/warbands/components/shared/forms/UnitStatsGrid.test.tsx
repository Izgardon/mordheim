import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UnitStatsGrid from "./UnitStatsGrid";

type TestUnit = {
  stats: Record<string, string>;
  armour_save: string;
};

function TestHarness({ raceStats }: { raceStats?: Record<string, number | null> }) {
  const [unit, setUnit] = React.useState<TestUnit>({
    stats: {
      M: "",
      WS: "",
      BS: "",
    },
    armour_save: "",
  });

  return (
    <UnitStatsGrid
      unit={unit}
      index={0}
      statFields={["M", "WS", "BS"]}
      inputClassName=""
      onUpdate={(_, updater) => setUnit((current) => updater(current))}
      raceStats={raceStats}
    />
  );
}

describe("UnitStatsGrid", () => {
  it("distributes spreadsheet-style pasted values across subsequent stat inputs", () => {
    render(<TestHarness />);

    const inputs = screen.getAllByPlaceholderText("-");
    fireEvent.paste(inputs[0], {
      clipboardData: {
        getData: () => "4\t3\t2\t6",
      },
    });

    expect(inputs[0]).toHaveValue("4");
    expect(inputs[1]).toHaveValue("3");
    expect(inputs[2]).toHaveValue("2");
    expect(inputs[3]).toHaveValue(6);
  });

  it("can start the paste from a later stat field", () => {
    render(<TestHarness />);

    const inputs = screen.getAllByPlaceholderText("-");
    fireEvent.paste(inputs[1], {
      clipboardData: {
        getData: () => "5\t4\t3",
      },
    });

    expect(inputs[0]).toHaveValue("");
    expect(inputs[1]).toHaveValue("5");
    expect(inputs[2]).toHaveValue("4");
    expect(inputs[3]).toHaveValue(3);
  });

  it("warns about values above the race maximum and keeps them (decision 10, BUG-32)", () => {
    render(<TestHarness raceStats={{ M: 4, WS: 6, BS: 6 }} />);
    const [movement, weaponSkill] = screen.getAllByPlaceholderText("-");

    fireEvent.change(weaponSkill, { target: { value: "6" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.change(weaponSkill, { target: { value: "7" } });
    fireEvent.change(movement, { target: { value: "5" } });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Above the race maximum: M 5 (max 4), WS 7 (max 6). This is allowed; check it's what you meant."
    );
    expect(weaponSkill).toHaveValue("7");
    expect(weaponSkill).toHaveAttribute("aria-invalid", "true");
  });
});
